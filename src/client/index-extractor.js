/**
 * ==============================================================================
 * INDEX EXTRACTOR - FULL AUTO SCAN & TRANSMITTER (TỰ ĐỘNG 100%)
 * ==============================================================================
 * Khi inject vào trang:
 * 1. Tự động quét toàn bộ DOM ngay lập tức.
 * 2. Tự động bóc Index, Câu hỏi, Đáp án.
 * 3. Tự động gửi thẳng về Web Dashboard http://localhost:3000 mà không cần bấm gì.
 * 4. Tự động theo dõi DOM (MutationObserver) nếu trang tải thêm câu hỏi bằng AJAX.
 * ==============================================================================
 */

(function () {
    'use strict';

    if (window.__AUTO_INDEX_EXTRACTOR_RUNNING__) {
        console.log('[AUTO EXTRACTOR] Tool đã được kích hoạt trên trang này.');
        if (window.IndexExtractor && window.IndexExtractor.scanAndSend) {
            window.IndexExtractor.scanAndSend();
        }
        return;
    }
    window.__AUTO_INDEX_EXTRACTOR_RUNNING__ = true;

    /* ==========================================================================
       1. CẤU HÌNH TỰ ĐỘNG
       ========================================================================== */
    const CONFIG = {
        DEBUG: true,
        SERVER_URL: 'http://localhost:3000/api/save',
        
        // TỰ ĐỘNG GỬI 100% NGAY KHI VÀO TRANG
        AUTO_SCAN_ON_LOAD: true,
        AUTO_SEND_TO_SERVER: true,
        AUTO_WATCH_DOM_CHANGES: true, // Tự động quét lại nếu web load thêm câu hỏi qua AJAX

        questionSelectors: [
            '.question',
            '.question-item',
            '.question-container',
            '.question-card',
            '.quiz-question',
            '.exam-question',
            '.test-question',
            '.que', // Moodle/LMS
            '.q-item',
            '[data-question]',
            '[data-question-id]',
            '[data-index]',
            '[class*="question"]',
            '[id*="question"]'
        ],

        optionSelectors: [
            '.option',
            '.option-item',
            '.answer',
            '.answer-item',
            '.choice',
            '.choice-item',
            '.quiz-answer',
            '.form-check',
            '[data-option]',
            '[class*="option"]',
            '[class*="answer"]',
            '[class*="choice"]'
        ],

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

        indexElementSelectors: [
            '.question-number',
            '.question-index',
            '.q-num',
            '.q-index',
            '.number',
            '.index',
            '[class*="question-number"]',
            '[class*="qno"]',
            '.no'
        ],

        questionPrefixRegexes: [
            /^(?:Question|Câu|Q|Item)\s*#?\s*(\d+)[\s.:-]*\s*/i,
            /^(\d+)[\s.:-]+\s*/i
        ],

        debounceTimeMs: 600
    };

    /* ==========================================================================
       2. CORE SCANNER
       ========================================================================== */
    class AutoScanner {
        static cleanText(str) {
            if (!str) return '';
            return str
                .replace(/\r\n/g, '\n')
                .replace(/\r/g, '\n')
                .replace(/[ \t]+/g, ' ')
                .replace(/\n\s*\n+/g, '\n')
                .trim();
        }

        static parseNum(val) {
            if (!val) return null;
            const n = Number(val);
            return !isNaN(n) ? n : val.trim();
        }

        static findContainers() {
            let containers = [];
            for (const selector of CONFIG.questionSelectors) {
                try {
                    const elements = Array.from(document.querySelectorAll(selector)).filter(el => {
                        if (el.closest('#auto-extractor-notification-host')) return false;
                        return el.textContent && el.textContent.trim().length > 0;
                    });
                    if (elements.length > 0) {
                        containers = elements;
                        break;
                    }
                } catch (e) {}
            }

            // Fallback nếu không có class quen thuộc
            if (containers.length === 0) {
                const pattern = /^(?:Question|Câu|Q)\s*\d+/i;
                const candidates = [];
                const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, {
                    acceptNode(node) {
                        if (node.parentElement && node.parentElement.closest('#auto-extractor-notification-host')) return NodeFilter.FILTER_REJECT;
                        return pattern.test(node.nodeValue.trim()) ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_SKIP;
                    }
                });
                let node;
                while ((node = walker.nextNode())) {
                    let p = node.parentElement;
                    while (p && p !== document.body) {
                        if (['div', 'section', 'article', 'li', 'fieldset'].includes(p.tagName.toLowerCase()) && p.textContent.trim().length > 20) break;
                        p = p.parentElement;
                    }
                    if (p && p !== document.body && !candidates.includes(p)) candidates.push(p);
                }
                containers = candidates;
            }

            return containers.filter((el, i, arr) => !arr.some((other, j) => i !== j && other !== el && other.contains(el)));
        }

        static extractIndex(container, domOrder) {
            if (container.getAttribute('data-index')) return { index: this.parseNum(container.getAttribute('data-index')), source: 'data-index' };
            if (container.getAttribute('data-question-index')) return { index: this.parseNum(container.getAttribute('data-question-index')), source: 'data-question-index' };
            if (container.getAttribute('data-question-id')) return { index: this.parseNum(container.getAttribute('data-question-id')), source: 'data-question-id' };
            if (container.getAttribute('data-id')) return { index: this.parseNum(container.getAttribute('data-id')), source: 'data-id' };
            if (container.id) {
                const match = container.id.match(/\d+/);
                if (match) return { index: Number(match[0]), source: 'id' };
            }
            for (const sel of CONFIG.indexElementSelectors) {
                const el = container.querySelector(sel);
                if (el && el.textContent.trim()) {
                    const match = el.textContent.trim().match(/\d+/);
                    if (match) return { index: Number(match[0]), source: `element:${sel}` };
                }
            }
            const text = container.textContent.trim();
            for (const regex of CONFIG.questionPrefixRegexes) {
                const match = text.match(regex);
                if (match && match[1]) return { index: Number(match[1]), source: 'text' };
            }
            return { index: domOrder + 1, source: 'generated' };
        }

        static extractOptions(container) {
            let optElements = [];
            for (const sel of CONFIG.optionSelectors) {
                const found = Array.from(container.querySelectorAll(sel));
                if (found.length > 0) {
                    optElements = found;
                    break;
                }
            }
            if (optElements.length === 0) return { options: [], optElements: [] };

            const options = optElements.map(el => {
                const clone = el.cloneNode(true);
                CONFIG.noiseSelectors.forEach(n => clone.querySelectorAll(n).forEach(x => x.remove()));
                return this.cleanText(clone.textContent);
            }).filter(t => t.length > 0);

            return { options, optElements };
        }

        static extractQuestionText(container, optElements) {
            const clone = container.cloneNode(true);
            CONFIG.optionSelectors.forEach(s => clone.querySelectorAll(s).forEach(x => x.remove()));
            CONFIG.noiseSelectors.forEach(s => clone.querySelectorAll(s).forEach(x => x.remove()));
            CONFIG.indexElementSelectors.forEach(s => clone.querySelectorAll(s).forEach(x => x.remove()));

            let text = this.cleanText(clone.textContent);
            for (const regex of CONFIG.questionPrefixRegexes) {
                if (regex.test(text)) text = text.replace(regex, '').trim();
            }
            return text;
        }

        static scan() {
            const containers = this.findContainers();
            const raw = [];

            containers.forEach((container, idx) => {
                const { index, source } = this.extractIndex(container, idx);
                const qId = container.getAttribute('data-question-id') || container.getAttribute('data-id') || container.id || String(index);
                const { options, optElements } = this.extractOptions(container);
                const questionText = this.extractQuestionText(container, optElements);

                if (questionText && questionText.length > 0) {
                    const item = { index, questionId: qId, question: questionText, indexSource: source };
                    if (options && options.length > 0) item.options = options;
                    raw.push(item);
                }
            });

            // Khử trùng lặp
            const uniqueMap = new Map();
            raw.forEach(item => {
                const key = item.question.trim().toLowerCase();
                if (!uniqueMap.has(key)) uniqueMap.set(key, item);
            });
            const results = Array.from(uniqueMap.values());

            // Sắp xếp tăng dần theo index
            results.sort((a, b) => {
                const numA = Number(a.index);
                const numB = Number(b.index);
                if (!isNaN(numA) && !isNaN(numB)) return numA - numB;
                return String(a.index).localeCompare(String(b.index), undefined, { numeric: true });
            });

            return results;
        }

        static async sendToServer(questions) {
            if (!questions || questions.length === 0) return null;

            const payload = {
                metadata: {
                    sourceUrl: window.location.href,
                    pageTitle: document.title,
                    timestamp: new Date().toISOString(),
                    totalQuestions: questions.length
                },
                questions: questions
            };

            const response = await fetch(CONFIG.SERVER_URL, {
                method: 'POST',
                mode: 'cors',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            return await response.json();
        }
    }

    /* ==========================================================================
       3. NOTIFICATION TOAST (HIỂN THỊ THÔNG BÁO GÓC MÀN HÌNH)
       ========================================================================== */
    class AutoNotification {
        static show(msg, isSuccess = true) {
            let host = document.getElementById('auto-extractor-notification-host');
            if (!host) {
                host = document.createElement('div');
                host.id = 'auto-extractor-notification-host';
                host.style.position = 'fixed';
                host.style.bottom = '20px';
                host.style.right = '20px';
                host.style.zIndex = '2147483647';
                document.body.appendChild(host);
            }

            const toast = document.createElement('div');
            toast.style.background = isSuccess ? '#065f46' : '#991b1b';
            toast.style.color = '#ffffff';
            toast.style.border = isSuccess ? '1px solid #10b981' : '1px solid #ef4444';
            toast.style.borderRadius = '8px';
            toast.style.padding = '12px 18px';
            toast.style.fontSize = '13px';
            toast.style.fontWeight = '600';
            toast.style.fontFamily = '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
            toast.style.boxShadow = '0 10px 25px rgba(0,0,0,0.5)';
            toast.style.marginBottom = '8px';
            toast.style.display = 'flex';
            toast.style.alignItems = 'center';
            toast.style.gap = '8px';
            toast.innerHTML = `<span>${isSuccess ? '⚡' : '⚠️'}</span> <span>${msg}</span>`;

            host.appendChild(toast);
            setTimeout(() => {
                toast.style.opacity = '0';
                toast.style.transition = 'opacity 0.5s ease';
                setTimeout(() => toast.remove(), 500);
            }, 4000);
        }
    }

    /* ==========================================================================
       4. AUTO RUNNER (TỰ ĐỘNG CHẠY NGAY LẬP TỨC)
       ========================================================================== */
    let lastQuestionCount = 0;
    let observer = null;
    let debounceTimer = null;

    async function executeAutoScanAndSend() {
        console.log('%c[AUTO EXTRACTOR] Đang tự động quét câu hỏi...', 'background:#2563eb;color:#fff;padding:2px 6px;border-radius:3px;font-weight:bold;');
        const results = AutoScanner.scan();

        if (results.length > 0) {
            console.log(`%c[AUTO EXTRACTOR] Tìm thấy ${results.length} câu hỏi. Đang tự động gửi về Server...`, 'background:#10b981;color:#fff;padding:2px 6px;border-radius:3px;font-weight:bold;');
            console.table(results);

            try {
                await AutoScanner.sendToServer(results);
                AutoNotification.show(`Đã tự động bóc và gửi ${results.length} câu hỏi về Dashboard!`, true);
                lastQuestionCount = results.length;
            } catch (err) {
                console.error('[AUTO EXTRACTOR] Không thể gửi về server:', err);
                AutoNotification.show(`Đã bóc ${results.length} câu (Chưa bật server localhost:3000)`, false);
            }
        } else {
            console.warn('[AUTO EXTRACTOR] Chưa tìm thấy câu hỏi trên trang.');
        }
        return results;
    }

    // Tự động quét lần 1 ngay lập tức
    setTimeout(executeAutoScanAndSend, 300);
    // Tự động quét lần 2 sau 1.5s (dành cho trang load dữ liệu AJAX)
    setTimeout(executeAutoScanAndSend, 1500);

    // 5. Tự động theo dõi DOM nếu trang web thêm câu hỏi mới
    if (CONFIG.AUTO_WATCH_DOM_CHANGES) {
        observer = new MutationObserver((mutations) => {
            const isSelf = mutations.every(m => m.target && (m.target.id === 'auto-extractor-notification-host' || (m.target.closest && m.target.closest('#auto-extractor-notification-host'))));
            if (isSelf) return;

            clearTimeout(debounceTimer);
            debounceTimer = setTimeout(async () => {
                const results = AutoScanner.scan();
                if (results.length !== lastQuestionCount && results.length > 0) {
                    console.log(`[AUTO EXTRACTOR] Phát hiện DOM thay đổi (Tổng: ${results.length} câu). Đang tự động cập nhật...`);
                    await executeAutoScanAndSend();
                }
            }, CONFIG.debounceTimeMs);
        });

        observer.observe(document.body, { childList: true, subtree: true });
    }

    window.IndexExtractor = {
        scanAndSend: executeAutoScanAndSend,
        scan: () => AutoScanner.scan(),
        getResults: () => AutoScanner.scan()
    };
})();
