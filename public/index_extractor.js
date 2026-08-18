/**
 * ==============================================================================
 * UNIVERSAL AUTO-DETECTOR & QUESTION EXTRACTOR
 * ==============================================================================
 * Chế độ: AUTO QUÉT MỌI WEBSITE & TỰ ĐỘNG LỌC CÂU HỎI
 * 
 * Cách hoạt động:
 * 1. Chạy trên MỌI trang web bạn mở trên trình duyệt.
 * 2. Tự động kiểm tra (Filter Heuristic):
 *    - Nếu trang là trang bình thường (Youtube, Facebook, Báo chí...) -> Im lặng bỏ qua.
 *    - Nếu phát hiện trang có chứa cấu trúc câu hỏi / trắc nghiệm -> TỰ ĐỘNG BÓC & GỬI NGAY.
 * 3. Tự động gửi về Dashboard http://localhost:3000 trong thời gian thực.
 * ==============================================================================
 */

(function () {
    'use strict';

    if (window.__UNIVERSAL_AUTO_EXTRACTOR_LOADED__) return;
    window.__UNIVERSAL_AUTO_EXTRACTOR_LOADED__ = true;

    const SERVER_URL = 'http://localhost:3000/api/save';

    // 1. Danh sách mẫu nhận diện câu hỏi phổ biến trên toàn cầu
    const QUESTION_SELECTORS = [
        '.question', '.question-item', '.question-container', '.question-card',
        '.quiz-question', '.exam-question', '.test-question', '.que', '.q-item',
        '[data-question]', '[data-question-id]', '[data-index]',
        '[class*="question"]', '[id*="question"]', '.card-body', '.question-box'
    ];

    const OPTION_SELECTORS = [
        '.option', '.option-item', '.answer', '.answer-item', '.choice',
        '.choice-item', '.quiz-answer', '.form-check', '[data-option]',
        '[class*="option"]', '[class*="answer"]', '[class*="choice"]',
        'label.radio', 'label.checkbox', 'li.answer'
    ];

    const NOISE_SELECTORS = [
        'button', 'script', 'style', 'svg', 'noscript', '.btn',
        '.actions', '.tooltip', '.badge', '[aria-hidden="true"]',
        'input[type="radio"]', 'input[type="checkbox"]'
    ];

    const PREFIX_REGEXES = [
        /^(?:Question|Câu|Q|Item|Bài)\s*#?\s*(\d+)[\s.:-]*\s*/i,
        /^(\d+)[\s.:-]+\s*/i
    ];

    /* ==========================================================================
       BỘ LỌC THÔNG MINH (HEURISTIC FILTER)
       ========================================================================== */
    class SmartDetector {
        static cleanText(s) {
            if (!s) return '';
            return s.replace(/\r\n/g, '\n').replace(/[ \t]+/g, ' ').replace(/\n\s*\n+/g, '\n').trim();
        }

        /**
         * Tìm các container câu hỏi trên bất kỳ trang web nào
         */
        static findContainers() {
            let candidates = [];

            // Cách 1: Thử các selector thông dụng
            for (const sel of QUESTION_SELECTORS) {
                try {
                    const found = Array.from(document.querySelectorAll(sel)).filter(el => {
                        if (el.closest('#universal-extractor-toast')) return false;
                        const txt = el.textContent ? el.textContent.trim() : '';
                        return txt.length >= 10 && txt.length <= 4000; // Độ dài hợp lý của 1 câu hỏi
                    });
                    if (found.length >= 1) {
                        candidates = found;
                        break;
                    }
                } catch (e) {}
            }

            // Cách 2: Quét Text Node tự động ("Question 1", "Câu 1", v.v.) nếu class không khớp
            if (candidates.length === 0) {
                const pattern = /^(?:Question|Câu|Q|Bài)\s*\d+/i;
                const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, {
                    acceptNode(node) {
                        if (node.parentElement && node.parentElement.closest('#universal-extractor-toast')) return NodeFilter.FILTER_REJECT;
                        return pattern.test(node.nodeValue.trim()) ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_SKIP;
                    }
                });

                let n;
                while ((n = walker.nextNode())) {
                    let p = n.parentElement;
                    while (p && p !== document.body) {
                        if (['div', 'section', 'article', 'li', 'fieldset'].includes(p.tagName.toLowerCase()) && p.textContent.trim().length > 20) break;
                        p = p.parentElement;
                    }
                    if (p && p !== document.body && !candidates.includes(p)) candidates.push(p);
                }
            }

            // Lọc bỏ phần tử lồng nhau
            return candidates.filter((el, i, arr) => !arr.some((other, j) => i !== j && other !== el && other.contains(el)));
        }

        static extractIndex(el, orderIdx) {
            let rawIdx = el.getAttribute('data-index') || el.getAttribute('data-question-index') || el.getAttribute('data-question-id') || el.getAttribute('data-id') || (el.id && el.id.match(/\d+/) ? el.id.match(/\d+/)[0] : null);
            let source = 'data-attribute';

            if (!rawIdx) {
                const numEl = el.querySelector('.question-number, .number, .index, [class*="question-number"], [class*="qno"]');
                if (numEl && numEl.textContent.match(/\d+/)) {
                    rawIdx = numEl.textContent.match(/\d+/)[0];
                    source = 'child-element';
                }
            }

            if (!rawIdx) {
                const txt = el.textContent.trim();
                for (const reg of PREFIX_REGEXES) {
                    const m = txt.match(reg);
                    if (m && m[1]) {
                        rawIdx = m[1];
                        source = 'text-prefix';
                        break;
                    }
                }
            }

            if (!rawIdx) {
                return { index: orderIdx + 1, source: 'generated' };
            }

            const num = Number(rawIdx);
            return { index: !isNaN(num) ? num : rawIdx.trim(), source: source };
        }

        static extractOptions(el) {
            let optEls = [];
            for (const sel of OPTION_SELECTORS) {
                const found = Array.from(el.querySelectorAll(sel));
                if (found.length > 0) {
                    optEls = found;
                    break;
                }
            }

            const options = optEls.map(o => {
                const clone = o.cloneNode(true);
                NOISE_SELECTORS.forEach(n => clone.querySelectorAll(n).forEach(x => x.remove()));
                return this.cleanText(clone.textContent);
            }).filter(t => t.length > 0);

            return { options, optEls };
        }

        static extractQuestionText(el, optEls) {
            const clone = el.cloneNode(true);
            OPTION_SELECTORS.forEach(s => clone.querySelectorAll(s).forEach(x => x.remove()));
            NOISE_SELECTORS.forEach(s => clone.querySelectorAll(s).forEach(x => x.remove()));
            clone.querySelectorAll('.question-number, .number, .index, [class*="question-number"]').forEach(x => x.remove());

            let txt = this.cleanText(clone.textContent);
            for (const reg of PREFIX_REGEXES) {
                if (reg.test(txt)) txt = txt.replace(reg, '').trim();
            }
            return txt;
        }

        static scanAndFilter() {
            const containers = this.findContainers();
            if (containers.length === 0) return []; // Không phải trang câu hỏi -> Bỏ qua

            const results = [];
            containers.forEach((el, idx) => {
                const { index, source } = this.extractIndex(el, idx);
                const qId = el.getAttribute('data-question-id') || el.getAttribute('data-id') || el.id || String(index);
                const { options, optEls } = this.extractOptions(el);
                const text = this.extractQuestionText(el, optEls);

                if (text && text.length >= 3) {
                    const item = {
                        index: index,
                        questionId: qId,
                        question: text,
                        indexSource: source
                    };
                    if (options.length > 0) item.options = options;
                    results.push(item);
                }
            });

            // Khử trùng lặp
            const map = new Map();
            results.forEach(r => {
                const k = r.question.toLowerCase().trim();
                if (!map.has(k)) map.set(k, r);
            });
            const unique = Array.from(map.values());

            // Sắp xếp tăng dần theo index
            unique.sort((a, b) => {
                const numA = Number(a.index);
                const numB = Number(b.index);
                if (!isNaN(numA) && !isNaN(numB)) return numA - numB;
                return String(a.index).localeCompare(String(b.index), undefined, { numeric: true });
            });

            return unique;
        }

        static async send(questions) {
            if (!questions || questions.length === 0) return;
            const payload = {
                metadata: {
                    sourceUrl: window.location.href,
                    pageTitle: document.title,
                    timestamp: new Date().toISOString(),
                    totalQuestions: questions.length
                },
                questions: questions
            };

            await fetch(SERVER_URL, {
                method: 'POST',
                mode: 'cors',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
        }
    }

    /* ==========================================================================
       TOAST THÔNG BÁO GÓC MÀN HÌNH
       ========================================================================== */
    function showToast(msg) {
        let host = document.getElementById('universal-extractor-toast');
        if (!host) {
            host = document.createElement('div');
            host.id = 'universal-extractor-toast';
            host.style.position = 'fixed';
            host.style.bottom = '20px';
            host.style.right = '20px';
            host.style.zIndex = '2147483647';
            document.body.appendChild(host);
        }

        const t = document.createElement('div');
        t.style.background = '#065f46';
        t.style.color = '#fff';
        t.style.border = '1px solid #10b981';
        t.style.borderRadius = '8px';
        t.style.padding = '10px 16px';
        t.style.fontSize = '12.5px';
        t.style.fontWeight = '600';
        t.style.fontFamily = '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
        t.style.boxShadow = '0 10px 25px rgba(0,0,0,0.5)';
        t.style.marginBottom = '6px';
        t.innerHTML = `⚡ ${msg}`;

        host.appendChild(t);
        setTimeout(() => {
            t.style.opacity = '0';
            t.style.transition = 'opacity 0.4s ease';
            setTimeout(() => t.remove(), 400);
        }, 3500);
    }

    /* ==========================================================================
       TỰ ĐỘNG CHẠY & THEO DÕI LIÊN TỤC
       ========================================================================== */
    let lastCount = 0;

    async function runAutoScan() {
        const questions = SmartDetector.scanAndFilter();
        if (questions.length > 0 && questions.length !== lastCount) {
            console.log(`%c[AUTO-SCANNER] 🎯 Đã lọc & bóc được ${questions.length} câu hỏi trên trang: ${document.title}`, 'background:#059669;color:#fff;padding:2px 6px;border-radius:3px;font-weight:bold;');
            console.table(questions);

            try {
                await SmartDetector.send(questions);
                showToast(`Đã tự động lọc & bóc ${questions.length} câu hỏi -> gửi về Dashboard!`);
                lastCount = questions.length;
            } catch (e) {
                console.warn('[AUTO-SCANNER] Không thể kết nối đến Dashboard localhost:3000');
            }
        }
    }

    // 1. Quét ngay khi trang vừa load xong
    setTimeout(runAutoScan, 500);
    setTimeout(runAutoScan, 2000); // Quét lại cho các trang SPA/AJAX

    // 2. Theo dõi nếu trang web load thêm câu hỏi khi cuộn hoặc bấm nút
    const obs = new MutationObserver(() => {
        clearTimeout(window.__auto_scan_timer);
        window.__auto_scan_timer = setTimeout(runAutoScan, 800);
    });
    obs.observe(document.body, { childList: true, subtree: true });

})();
