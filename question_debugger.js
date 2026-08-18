/**
 * ==============================================================================
 * QUESTION DEBUGGER & ANALYZER (Client-Side Inspection Tool)
 * ==============================================================================
 * Mục đích: Công cụ hỗ trợ lập trình viên kiểm thử & debug luồng dữ liệu câu hỏi
 *           (Web page -> JavaScript -> Network Response -> JSON -> DOM -> Index)
 * 
 * Phạm vi hoạt động:
 * - Chỉ đọc (read-only) dữ liệu đã được nạp/render trong phiên duyệt web hiện tại.
 * - Không can thiệp, không bypass bảo mật, không gửi request trái phép.
 * - Hỗ trợ phân tích DOM, bộ nhớ JavaScript runtime và ghi nhận thụ động Network.
 * 
 * @version 2.0.0
 * ==============================================================================
 */

(function () {
    'use strict';

    /* ==========================================================================
       MODULE 1: CONFIGURATION (Cấu hình bộ phân tích)
       ========================================================================== */
    const CONFIG = {
        DEBUG: true,

        // Selectors nhận diện container câu hỏi trên DOM
        questionSelectors: [
            '.question',
            '.question-item',
            '.question-container',
            '.question-card',
            '.quiz-question',
            '.exam-question',
            '.test-question',
            '.que', // Moodle/LMS
            '[data-question]',
            '[data-question-id]',
            '[data-index]',
            '[class*="question"]',
            '[id*="question"]'
        ],

        // Selectors nhận diện đáp án (options)
        optionSelectors: [
            '.option',
            '.option-item',
            '.answer',
            '.answer-item',
            '.choice',
            '.choice-item',
            '[data-option]',
            '[class*="option"]',
            '[class*="answer"]'
        ],

        // Phần tử nhiễu cần loại bỏ khi bóc nội dung text câu hỏi
        noiseSelectors: [
            'button',
            'script',
            'style',
            'svg',
            'noscript',
            '.btn',
            '.actions',
            '.tooltip',
            '.badge',
            '[aria-hidden="true"]',
            'input[type="radio"]',
            'input[type="checkbox"]'
        ],

        // Thuộc tính & phần tử chứa số thứ tự câu hỏi
        indexElementSelectors: [
            '.question-number',
            '.question-index',
            '.q-num',
            '.q-index',
            '.number',
            '.index',
            '[class*="question-number"]',
            '[class*="qno"]'
        ],

        // Regex phát hiện tiền tố index ("Question 1", "Câu 15", "1.", etc.)
        questionPrefixRegexes: [
            /^(?:Question|Câu|Q|Item)\s*#?\s*(\d+)[\s.:-]*\s*/i,
            /^(\d+)[\s.:-]+\s*/i
        ],

        // Từ khóa nhận diện dữ liệu câu hỏi trong bộ nhớ JavaScript Runtime
        runtimeKeywords: [
            'question',
            'questions',
            'questionId',
            'questionIndex',
            'quiz',
            'exam',
            'examData',
            'testData',
            'items',
            'answers'
        ],

        // Debounce time (ms) cho MutationObserver
        debounceTimeMs: 500
    };

    /* ==========================================================================
       MODULE 2: LOGGER UTILITY
       ========================================================================== */
    const Logger = {
        badge(label, color = '#2563eb') {
            return [`%c[${label}]`, `background: ${color}; color: #fff; padding: 2px 6px; border-radius: 3px; font-weight: bold;`];
        },
        log(module, msg, ...args) {
            if (!CONFIG.DEBUG) return;
            const [bText, bStyle] = this.badge(module, '#2563eb');
            console.log(`${bText} ${msg}`, bStyle, ...args);
        },
        info(module, msg, ...args) {
            if (!CONFIG.DEBUG) return;
            const [bText, bStyle] = this.badge(module, '#0284c7');
            console.info(`${bText} ${msg}`, bStyle, ...args);
        },
        warn(module, msg, ...args) {
            if (!CONFIG.DEBUG) return;
            const [bText, bStyle] = this.badge(module, '#d97706');
            console.warn(`${bText} ${msg}`, bStyle, ...args);
        },
        error(module, msg, ...args) {
            const [bText, bStyle] = this.badge(module, '#dc2626');
            console.error(`${bText} ${msg}`, bStyle, ...args);
        }
    };

    /* ==========================================================================
       MODULE 3: PASSIVE NETWORK OBSERVER (Quan sát API Responses)
       ========================================================================== */
    class PassiveNetworkObserver {
        constructor() {
            this.capturedPayloads = [];
            this.isHooked = false;
        }

        init() {
            if (this.isHooked) return;
            this.hookFetch();
            this.hookXHR();
            this.isHooked = true;
            Logger.info('NETWORK', 'Passive Network Observer initialized (read-only mode).');
        }

        /**
         * Lắng nghe các response từ window.fetch đã diễn ra
         */
        hookFetch() {
            const originalFetch = window.fetch;
            const self = this;

            window.fetch = async function (...args) {
                const response = await originalFetch.apply(this, args);
                try {
                    const url = typeof args[0] === 'string' ? args[0] : (args[0] && args[0].url) || '';
                    const contentType = response.headers.get('content-type') || '';

                    if (contentType.includes('application/json')) {
                        // Clone response để không tiêu thụ luồng đọc của website
                        const clone = response.clone();
                        clone.json().then(data => {
                            self.inspectAndSavePayload({
                                url: url,
                                method: (args[1] && args[1].method) || 'GET',
                                status: response.status,
                                contentType: contentType,
                                data: data
                            });
                        }).catch(() => {});
                    }
                } catch (e) {
                    // Tránh gây lỗi cho ứng dụng chính
                }
                return response;
            };
        }

        /**
         * Lắng nghe các response từ XMLHttpRequest
         */
        hookXHR() {
            const originalOpen = XMLHttpRequest.prototype.open;
            const originalSend = XMLHttpRequest.prototype.send;
            const self = this;

            XMLHttpRequest.prototype.open = function (method, url) {
                this._debugMethod = method;
                this._debugUrl = url;
                return originalOpen.apply(this, arguments);
            };

            XMLHttpRequest.prototype.send = function () {
                this.addEventListener('load', function () {
                    try {
                        const contentType = this.getResponseHeader('content-type') || '';
                        if (contentType.includes('application/json') && this.responseText) {
                            const data = JSON.parse(this.responseText);
                            self.inspectAndSavePayload({
                                url: this._debugUrl || '',
                                method: this._debugMethod || 'GET',
                                status: this.status,
                                contentType: contentType,
                                data: data
                            });
                        }
                    } catch (e) {}
                });
                return originalSend.apply(this, arguments);
            };
        }

        inspectAndSavePayload(entry) {
            // Kiểm tra xem JSON data có chứa các trường liên quan đến câu hỏi không
            const jsonStr = JSON.stringify(entry.data).toLowerCase();
            const hasKeyword = CONFIG.runtimeKeywords.some(k => jsonStr.includes(`"${k.toLowerCase()}"`));

            if (hasKeyword) {
                this.capturedPayloads.push(entry);
                Logger.info('NETWORK', `Captured relevant JSON response from: ${entry.url}`, entry);
            }
        }

        getCapturedData() {
            return this.capturedPayloads;
        }
    }

    /* ==========================================================================
       MODULE 4: JAVASCRIPT RUNTIME DATA DETECTOR (Phân tích bộ nhớ JS)
       ========================================================================== */
    class RuntimeDataDetector {
        constructor() {
            this.detectedQuestions = [];
        }

        /**
         * Quét an toàn các object trong window & framework state
         */
        analyzeRuntime() {
            this.detectedQuestions = [];
            Logger.log('DATA', 'Starting JavaScript Runtime inspection...');

            const visited = new WeakSet();
            const candidateArrays = [];

            // 1. Quét các biến toàn cục trên window
            const globalKeys = Object.getOwnPropertyNames(window);
            for (const key of globalKeys) {
                try {
                    // Bỏ qua các object hệ thống của browser
                    if (['window', 'document', 'location', 'top', 'frames', 'self', 'parent'].includes(key)) continue;
                    if (key.startsWith('webkit') || key.startsWith('chrome')) continue;

                    const val = window[key];
                    if (val && typeof val === 'object') {
                        this.searchObjectForQuestions(val, key, visited, candidateArrays, 0);
                    }
                } catch (e) {}
            }

            // 2. Tìm kiếm trong các hook framework phổ biến (React Fiber, Vue instances nếu có)
            this.checkFrameworkRoots(candidateArrays);

            // 3. Chuẩn hóa kết quả tìm được từ candidate arrays
            candidateArrays.forEach(arr => {
                arr.forEach(item => {
                    const normalized = this.normalizeJSQuestion(item);
                    if (normalized) {
                        this.detectedQuestions.push(normalized);
                    }
                });
            });

            Logger.info('DATA', `Runtime detector identified ${this.detectedQuestions.length} questions in memory.`);
            return this.detectedQuestions;
        }

        searchObjectForQuestions(obj, path, visited, results, depth) {
            if (!obj || typeof obj !== 'object' || depth > 3) return;
            if (visited.has(obj)) return;
            visited.add(obj);

            // Nếu là mảng
            if (Array.isArray(obj)) {
                if (obj.length > 0 && typeof obj[0] === 'object' && obj[0] !== null) {
                    // Kiểm tra xem phần tử trong mảng có đặc trưng câu hỏi không
                    const sample = obj[0];
                    const keys = Object.keys(sample).map(k => k.toLowerCase());
                    const match = keys.some(k => k.includes('question') || k.includes('title') || k.includes('content'))
                               && (keys.some(k => k.includes('id') || k.includes('index') || k.includes('option') || k.includes('answer')));

                    if (match) {
                        Logger.log('DATA', `Found question array in JS Runtime at: window.${path} (length: ${obj.length})`);
                        results.push(obj);
                        return;
                    }
                }
            }

            // Đệ quy quét các thuộc tính con (giới hạn độ sâu 3 cấp để an toàn bộ nhớ)
            try {
                for (const k of Object.keys(obj)) {
                    if (typeof obj[k] === 'object' && obj[k] !== null) {
                        this.searchObjectForQuestions(obj[k], `${path}.${k}`, visited, results, depth + 1);
                    }
                }
            } catch (e) {}
        }

        checkFrameworkRoots(results) {
            try {
                // Vue 3 app instance
                const vueAppEl = document.querySelector('#app') || document.querySelector('[data-v-app]');
                if (vueAppEl && vueAppEl.__vue_app__) {
                    Logger.log('DATA', 'Detected Vue 3 application root.');
                }
            } catch (e) {}
        }

        normalizeJSQuestion(raw) {
            if (!raw || typeof raw !== 'object') return null;

            const keys = Object.keys(raw);
            const findKey = (...aliases) => keys.find(k => aliases.includes(k.toLowerCase()));

            const questionKey = findKey('question', 'questiontext', 'content', 'title', 'stem', 'qtext');
            const idKey = findKey('id', 'questionid', 'qid', '_id', 'itemid');
            const indexKey = findKey('index', 'questionindex', 'no', 'number', 'orderno');
            const optionsKey = findKey('options', 'answers', 'choices', 'optionlist');

            if (!questionKey && !idKey) return null;

            const questionText = questionKey ? String(raw[questionKey]).trim() : '';
            const questionId = idKey ? String(raw[idKey]).trim() : (indexKey ? String(raw[indexKey]) : undefined);
            const index = indexKey ? Number(raw[indexKey]) || raw[indexKey] : undefined;

            let options = [];
            if (optionsKey && Array.isArray(raw[optionsKey])) {
                options = raw[optionsKey].map(opt => {
                    if (typeof opt === 'string') return opt.trim();
                    if (typeof opt === 'object' && opt !== null) {
                        return opt.text || opt.content || opt.answer || JSON.stringify(opt);
                    }
                    return String(opt);
                });
            }

            return {
                index: index,
                questionId: questionId,
                question: questionText,
                options: options.length > 0 ? options : undefined,
                sourceType: 'js-runtime'
            };
        }
    }

    /* ==========================================================================
       MODULE 5: DOM SCANNER & INDEX EXTRACTOR
       ========================================================================== */
    class DOMQuestionScanner {
        constructor() {
            this.items = [];
        }

        /**
         * Sinh CSS selector đường dẫn duy nhất cho element để hỗ trợ debug
         */
        generateCSSSelector(el) {
            if (el.id) return `#${el.id}`;
            const path = [];
            while (el && el.nodeType === Node.ELEMENT_NODE && el !== document.body) {
                let selector = el.nodeName.toLowerCase();
                if (el.className && typeof el.className === 'string') {
                    const cleanClass = el.className.trim().split(/\s+/).filter(c => !c.startsWith('ng-') && !c.startsWith('v-'))[0];
                    if (cleanClass) selector += `.${cleanClass}`;
                }
                const parent = el.parentNode;
                if (parent) {
                    const siblings = Array.from(parent.children).filter(c => c.nodeName === el.nodeName);
                    if (siblings.length > 1) {
                        const index = siblings.indexOf(el) + 1;
                        selector += `:nth-child(${index})`;
                    }
                }
                path.unshift(selector);
                el = parent;
            }
            return path.join(' > ');
        }

        /**
         * Tìm các container câu hỏi trên trang
         */
        findContainers() {
            let containers = [];
            for (const selector of CONFIG.questionSelectors) {
                try {
                    const els = Array.from(document.querySelectorAll(selector)).filter(el => {
                        if (el.closest('#question-debugger-host')) return false;
                        return el.textContent && el.textContent.trim().length > 0;
                    });
                    if (els.length > 0) {
                        Logger.log('DOM', `Matched ${els.length} elements with selector: "${selector}"`);
                        containers = els;
                        break;
                    }
                } catch (e) {}
            }

            // Fallback: Tìm qua Text TreeWalker nếu selector không khớp
            if (containers.length === 0) {
                Logger.info('DOM', 'No container matched via selectors. Running Text fallback search...');
                containers = this.findContainersByText();
            }

            // Loại bỏ các container bị lồng nhau bên trong container khác
            return containers.filter((el, i, arr) => !arr.some((other, j) => i !== j && other !== el && other.contains(el)));
        }

        findContainersByText() {
            const pattern = /^(?:Question|Câu|Q)\s*\d+/i;
            const candidates = [];
            const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, {
                acceptNode(node) {
                    if (node.parentElement && node.parentElement.closest('#question-debugger-host')) return NodeFilter.FILTER_REJECT;
                    return pattern.test(node.nodeValue.trim()) ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_SKIP;
                }
            });

            let node;
            while ((node = walker.nextNode())) {
                let p = node.parentElement;
                while (p && p !== document.body) {
                    if (['div', 'section', 'article', 'li', 'fieldset'].includes(p.tagName.toLowerCase()) && p.textContent.trim().length > 20) {
                        break;
                    }
                    p = p.parentElement;
                }
                if (p && p !== document.body && !candidates.includes(p)) candidates.push(p);
            }
            return candidates;
        }

        /**
         * Xác định Index & Nguồn gốc Index (indexSource)
         */
        extractIndex(container, domOrder) {
            // 1. data-index
            if (container.hasAttribute('data-index')) {
                const val = container.getAttribute('data-index');
                return { index: this.parseNumeric(val), indexSource: 'data-index' };
            }
            // 2. data-question-index
            if (container.hasAttribute('data-question-index')) {
                const val = container.getAttribute('data-question-index');
                return { index: this.parseNumeric(val), indexSource: 'data-question-index' };
            }
            // 3. data-question-id
            if (container.hasAttribute('data-question-id')) {
                const val = container.getAttribute('data-question-id');
                return { index: this.parseNumeric(val), indexSource: 'data-question-id' };
            }
            // 4. data-id
            if (container.hasAttribute('data-id')) {
                const val = container.getAttribute('data-id');
                return { index: this.parseNumeric(val), indexSource: 'data-id' };
            }
            // 5. id attribute
            if (container.id) {
                const match = container.id.match(/\d+/);
                if (match) {
                    return { index: Number(match[0]), indexSource: 'id' };
                }
            }
            // 6. Thuộc tính hoặc thẻ con chứa index / number
            for (const sel of CONFIG.indexElementSelectors) {
                const el = container.querySelector(sel);
                if (el && el.textContent.trim()) {
                    const match = el.textContent.trim().match(/\d+/);
                    if (match) {
                        return { index: Number(match[0]), indexSource: `element:${sel}` };
                    }
                }
            }
            // 7. Text pattern (Question 1, Câu 1)
            const text = container.textContent.trim();
            for (const regex of CONFIG.questionPrefixRegexes) {
                const match = text.match(regex);
                if (match && match[1]) {
                    return { index: Number(match[1]), indexSource: 'text' };
                }
            }
            // 8. Fallback thứ tự DOM
            return { index: domOrder + 1, indexSource: 'generated' };
        }

        /**
         * Lấy ID câu hỏi (questionId) nếu có
         */
        extractQuestionId(container, extractedIndex) {
            return container.getAttribute('data-question-id')
                || container.getAttribute('data-id')
                || container.getAttribute('id')
                || (extractedIndex ? String(extractedIndex) : undefined);
        }

        /**
         * Bóc các options đáp án
         */
        extractOptions(container) {
            let options = [];
            let optElements = [];
            for (const sel of CONFIG.optionSelectors) {
                const found = Array.from(container.querySelectorAll(sel));
                if (found.length > 0) {
                    optElements = found;
                    break;
                }
            }
            if (optElements.length > 0) {
                options = optElements.map(el => {
                    const clone = el.cloneNode(true);
                    CONFIG.noiseSelectors.forEach(n => clone.querySelectorAll(n).forEach(x => x.remove()));
                    return this.cleanText(clone.textContent);
                }).filter(t => t.length > 0);
            }
            return { options, optElements };
        }

        /**
         * Bóc chuỗi text câu hỏi sạch
         */
        extractQuestionText(container, optElements) {
            const clone = container.cloneNode(true);
            CONFIG.optionSelectors.forEach(s => clone.querySelectorAll(s).forEach(x => x.remove()));
            CONFIG.noiseSelectors.forEach(s => clone.querySelectorAll(s).forEach(x => x.remove()));
            CONFIG.indexElementSelectors.forEach(s => clone.querySelectorAll(s).forEach(x => x.remove()));

            let text = this.cleanText(clone.textContent);
            for (const regex of CONFIG.questionPrefixRegexes) {
                if (regex.test(text)) {
                    text = text.replace(regex, '').trim();
                }
            }
            return text;
        }

        cleanText(str) {
            if (!str) return '';
            return str
                .replace(/\r\n/g, '\n')
                .replace(/\r/g, '\n')
                .replace(/[ \t]+/g, ' ')
                .replace(/\n\s*\n+/g, '\n')
                .trim();
        }

        parseNumeric(val) {
            if (!val) return null;
            const num = Number(val);
            return !isNaN(num) ? num : val.trim();
        }

        scan() {
            Logger.log('DOM', 'Scanning DOM for question elements...');
            const containers = this.findContainers();
            const items = [];

            containers.forEach((container, idx) => {
                const { index, indexSource } = this.extractIndex(container, idx);
                const questionId = this.extractQuestionId(container, index);
                const { options, optElements } = this.extractOptions(container);
                const questionText = this.extractQuestionText(container, optElements);
                const selector = this.generateCSSSelector(container);

                if (questionText && questionText.length > 0) {
                    const qObj = {
                        index: index,
                        questionId: questionId,
                        question: questionText,
                        indexSource: indexSource,
                        selector: selector
                    };
                    if (options && options.length > 0) {
                        qObj.options = options;
                    }
                    items.push(qObj);
                }
            });

            this.items = items;
            Logger.info('DOM', `DOM Scanner extracted ${items.length} items.`);
            return items;
        }
    }

    /* ==========================================================================
       MODULE 6: NORMALIZER & DEDUPLICATOR
       ========================================================================== */
    class DataNormalizer {
        static process(items) {
            const totalRaw = items.length;
            const uniqueMap = new Map();
            let duplicateCount = 0;

            items.forEach(item => {
                // Key khử trùng lặp: kết hợp lowercase question text hoặc questionId
                const dupKey = (item.question || '').trim().toLowerCase();
                if (uniqueMap.has(dupKey)) {
                    duplicateCount++;
                } else {
                    uniqueMap.set(dupKey, item);
                }
            });

            const uniqueList = Array.from(uniqueMap.values());

            // Sắp xếp index tăng dần
            uniqueList.sort((a, b) => {
                const numA = Number(a.index);
                const numB = Number(b.index);
                if (!isNaN(numA) && !isNaN(numB)) return numA - numB;
                return String(a.index).localeCompare(String(b.index), undefined, { numeric: true });
            });

            return {
                results: uniqueList,
                stats: {
                    totalFound: totalRaw,
                    totalUnique: uniqueList.length,
                    totalIndexes: uniqueList.filter(i => i.index !== undefined && i.index !== null).length,
                    duplicates: duplicateCount
                }
            };
        }
    }

    /* ==========================================================================
       MODULE 7: FLOATING DEBUGGER UI (SHADOW DOM ISOLATED)
       ========================================================================== */
    class FloatingDebuggerUI {
        constructor(domScanner, dataDetector, networkObserver) {
            this.domScanner = domScanner;
            this.dataDetector = dataDetector;
            this.networkObserver = networkObserver;
            this.hostId = 'question-debugger-host';
            this.shadow = null;
            this.currentResults = [];
            this.observer = null;
            this.debounceTimer = null;
        }

        init() {
            const old = document.getElementById(this.hostId);
            if (old) old.remove();

            const host = document.createElement('div');
            host.id = this.hostId;
            host.style.position = 'fixed';
            host.style.bottom = '20px';
            host.style.right = '20px';
            host.style.zIndex = '2147483647';
            host.style.fontFamily = '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';

            this.shadow = host.attachShadow({ mode: 'open' });
            this.render();
            document.body.appendChild(host);

            this.bindEvents();
            this.setupMutationObserver();

            // Tự động quét DOM khi khởi tạo
            this.handleScanDOM();
        }

        render() {
            const css = `
                * { box-sizing: border-box; margin: 0; padding: 0; }
                .panel {
                    width: 310px;
                    background: #0f172a;
                    color: #f8fafc;
                    border: 1px solid #334155;
                    border-radius: 10px;
                    box-shadow: 0 10px 25px rgba(0,0,0,0.6);
                    padding: 14px;
                    font-size: 13px;
                    transition: all 0.2s ease;
                }
                .panel.minimized .body { display: none; }
                .panel.minimized { width: 200px; padding: 8px 12px; }
                .header {
                    display: flex;
                    align-items: center;
                    justify-content: space-between;
                    margin-bottom: 10px;
                }
                .title {
                    font-weight: 700;
                    font-size: 13px;
                    color: #38bdf8;
                    display: flex;
                    align-items: center;
                    gap: 6px;
                }
                .actions { display: flex; gap: 4px; }
                .icon-btn {
                    background: #1e293b;
                    border: 1px solid #334155;
                    color: #94a3b8;
                    cursor: pointer;
                    width: 22px;
                    height: 22px;
                    border-radius: 4px;
                    font-size: 11px;
                    font-weight: bold;
                }
                .icon-btn:hover { background: #334155; color: #fff; }
                .metrics {
                    background: #1e293b;
                    border: 1px solid #334155;
                    border-radius: 6px;
                    padding: 8px 10px;
                    margin-bottom: 10px;
                    display: grid;
                    grid-template-columns: 1fr 1fr 1fr;
                    gap: 6px;
                    text-align: center;
                }
                .m-label { font-size: 10px; color: #94a3b8; text-transform: uppercase; }
                .m-val { font-size: 14px; font-weight: 700; color: #38bdf8; margin-top: 2px; }
                .m-val.green { color: #4ade80; }
                .m-val.amber { color: #fbbf24; }
                .btn-grid {
                    display: grid;
                    grid-template-columns: 1fr 1fr;
                    gap: 6px;
                    margin-bottom: 10px;
                }
                .btn {
                    padding: 7px 10px;
                    border-radius: 5px;
                    border: none;
                    cursor: pointer;
                    font-weight: 600;
                    font-size: 11px;
                    transition: background 0.15s;
                }
                .btn-primary { background: #0284c7; color: white; }
                .btn-primary:hover { background: #0369a1; }
                .btn-secondary { background: #334155; color: #f1f5f9; }
                .btn-secondary:hover { background: #475569; }
                .btn-success { background: #059669; color: white; }
                .btn-success:hover { background: #047857; }
                .btn-danger { background: #dc2626; color: white; }
                .btn-danger:hover { background: #b91c1c; }
                .status-row {
                    font-size: 11px;
                    color: #94a3b8;
                    display: flex;
                    justify-content: space-between;
                    border-top: 1px solid #334155;
                    padding-top: 6px;
                }
            `;

            this.shadow.innerHTML = `
                <style>${css}</style>
                <div class="panel" id="panel">
                    <div class="header">
                        <div class="title">🔍 QUESTION DEBUGGER</div>
                        <div class="actions">
                            <button class="icon-btn" id="btn-min" title="Minimize/Expand">_</button>
                            <button class="icon-btn" id="btn-close" title="Close">✕</button>
                        </div>
                    </div>
                    <div class="body">
                        <div class="metrics">
                            <div>
                                <div class="m-label">Questions</div>
                                <div class="m-val green" id="stat-q">0</div>
                            </div>
                            <div>
                                <div class="m-label">Indexes</div>
                                <div class="m-val" id="stat-idx">0</div>
                            </div>
                            <div>
                                <div class="m-label">Duplicates</div>
                                <div class="m-val amber" id="stat-dup">0</div>
                            </div>
                        </div>

                        <div class="btn-grid">
                            <button class="btn btn-primary" id="btn-scan-dom">SCAN DOM</button>
                            <button class="btn btn-secondary" id="btn-analyze-data">ANALYZE DATA</button>
                            <button class="btn btn-success" id="btn-copy-json">COPY JSON</button>
                            <button class="btn btn-danger" id="btn-clear">CLEAR</button>
                        </div>

                        <div class="status-row">
                            <span>Status: <strong id="status-txt" style="color:#e2e8f0;">Ready</strong></span>
                            <span id="source-badge" style="color:#38bdf8;">DOM Mode</span>
                        </div>
                    </div>
                </div>
            `;
        }

        bindEvents() {
            const root = this.shadow;
            root.getElementById('btn-scan-dom').addEventListener('click', () => this.handleScanDOM());
            root.getElementById('btn-analyze-data').addEventListener('click', () => this.handleAnalyzeData());
            root.getElementById('btn-copy-json').addEventListener('click', () => this.handleCopyJSON());
            root.getElementById('btn-clear').addEventListener('click', () => this.handleClear());

            root.getElementById('btn-min').addEventListener('click', () => {
                root.getElementById('panel').classList.toggle('minimized');
            });

            root.getElementById('btn-close').addEventListener('click', () => {
                if (this.observer) this.observer.disconnect();
                const host = document.getElementById(this.hostId);
                if (host) host.remove();
            });
        }

        setupMutationObserver() {
            this.observer = new MutationObserver((mutations) => {
                // Tránh phản hồi lặp lại do UI của chính debugger tạo ra
                const isSelf = mutations.every(m => m.target && (m.target.id === this.hostId || (m.target.closest && m.target.closest('#' + this.hostId))));
                if (isSelf) return;

                clearTimeout(this.debounceTimer);
                this.debounceTimer = setTimeout(() => {
                    Logger.info('DOM', 'Dynamic mutation detected. Refreshing DOM scan...');
                    this.handleScanDOM(true);
                }, CONFIG.debounceTimeMs);
            });

            this.observer.observe(document.body, { childList: true, subtree: true });
        }

        updateUI(stats, sourceLabel) {
            this.shadow.getElementById('stat-q').textContent = stats.totalUnique;
            this.shadow.getElementById('stat-idx').textContent = stats.totalIndexes;
            this.shadow.getElementById('stat-dup').textContent = stats.duplicates;
            this.shadow.getElementById('source-badge').textContent = sourceLabel;
        }

        setStatus(txt) {
            this.shadow.getElementById('status-txt').textContent = txt;
        }

        handleScanDOM(isAuto = false) {
            this.setStatus(isAuto ? 'Auto-scanning...' : 'Scanning DOM...');
            const raw = this.domScanner.scan();
            const { results, stats } = DataNormalizer.process(raw);
            this.currentResults = results;
            this.updateUI(stats, 'DOM Mode');
            this.setStatus(`Scanned ${results.length} items`);

            // Xuất ra Console dạng bảng
            this.printResults('DOM Scan Results', results);
        }

        handleAnalyzeData() {
            this.setStatus('Analyzing JS Runtime...');
            const jsItems = this.dataDetector.analyzeRuntime();
            const netItems = [];

            // Gộp thêm dữ liệu phân tích từ Network responses
            const netPayloads = this.networkObserver.getCapturedData();
            netPayloads.forEach(payload => {
                if (Array.isArray(payload.data)) {
                    payload.data.forEach(item => {
                        const norm = this.dataDetector.normalizeJSQuestion(item);
                        if (norm) netItems.push(norm);
                    });
                }
            });

            const combined = [...jsItems, ...netItems];
            const { results, stats } = DataNormalizer.process(combined);
            this.currentResults = results;
            this.updateUI(stats, 'JS/API Mode');
            this.setStatus(`Found ${results.length} data objects`);

            this.printResults('JS Runtime & Network Data Analysis', results);
        }

        printResults(title, results) {
            console.log(
                `%c[QUESTION DEBUGGER] ${title}: ${results.length} items`,
                'background: #0284c7; color: white; padding: 4px 8px; font-weight: bold; border-radius: 4px;'
            );
            if (results.length > 0) {
                const tableData = results.map(r => ({
                    index: r.index,
                    questionId: r.questionId || 'N/A',
                    question: (r.question || '').length > 60 ? (r.question || '').substring(0, 60) + '...' : r.question,
                    indexSource: r.indexSource || r.sourceType || 'N/A'
                }));
                console.table(tableData);
                console.log('Full Debugger Payload:', results);
            }
        }

        handleCopyJSON() {
            if (!this.currentResults || this.currentResults.length === 0) {
                this.setStatus('No data!');
                return;
            }
            const jsonStr = JSON.stringify(this.currentResults, null, 2);
            navigator.clipboard.writeText(jsonStr).then(() => {
                this.setStatus('Copied JSON!');
                setTimeout(() => this.setStatus('Ready'), 2000);
            }).catch(() => {
                this.setStatus('Copy failed!');
            });
        }

        handleClear() {
            this.currentResults = [];
            this.updateUI({ totalUnique: 0, totalIndexes: 0, duplicates: 0 }, 'Idle');
            this.setStatus('Cleared');
            console.clear();
            Logger.info('DEBUGGER', 'Console and local data cleared.');
        }
    }

    /* ==========================================================================
       MODULE 8: INITIALIZATION BOOTSTRAP
       ========================================================================== */
    const networkObserver = new PassiveNetworkObserver();
    networkObserver.init();

    const dataDetector = new RuntimeDataDetector();
    const domScanner = new DOMQuestionScanner();
    const ui = new FloatingDebuggerUI(domScanner, dataDetector, networkObserver);
    ui.init();

    // Export API vào window để kiểm thử chủ động từ Console
    window.QuestionDebugger = {
        config: CONFIG,
        domScanner: domScanner,
        dataDetector: dataDetector,
        networkObserver: networkObserver,
        ui: ui,
        scanDOM: () => ui.handleScanDOM(),
        analyzeData: () => ui.handleAnalyzeData(),
        getResults: () => ui.currentResults
    };

    Logger.info('DEBUGGER', 'Question Debugger ready. Press [SCAN DOM] or [ANALYZE DATA] to inspect.');
})();
