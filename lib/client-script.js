/**
 * ==============================================================================
 * MODULE: CLIENT-SIDE EXTRACTOR (Bundle mã JavaScript được tiêm vào HTML)
 * ==============================================================================
 */

const CONFIG = require('../config');

function getInjectedClientScript() {
    return `
(function () {
    'use strict';

    if (window.__CLOUD_INDEX_EXTRACTOR_INJECTED__) return;
    window.__CLOUD_INDEX_EXTRACTOR_INJECTED__ = true;

    console.log('%c[CLOUD EXTRACTOR] 🚀 Injected Index Extractor is active.', 'background:#2563eb;color:#fff;padding:2px 6px;border-radius:3px;font-weight:bold;');

    const SAVE_ENDPOINT = '/api/save';

    const QUESTION_SELECTORS = [
        '.question', '.question-item', '.question-container', '.question-card',
        '.quiz-question', '.exam-question', '.test-question', '.que', '.q-item',
        '[data-question]', '[data-question-id]', '[data-index]',
        '[class*="question"]', '[id*="question"]'
    ];

    const OPTION_SELECTORS = [
        '.option', '.option-item', '.answer', '.answer-item', '.choice',
        '.choice-item', '.quiz-answer', '.form-check', '[data-option]',
        '[class*="option"]', '[class*="answer"]', '[class*="choice"]'
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

    class DOMScanner {
        static cleanText(s) {
            if (!s) return '';
            return s.replace(/\\r\\n/g, '\\n').replace(/[ \\t]+/g, ' ').replace(/\\n\\s*\\n+/g, '\\n').trim();
        }

        static findContainers() {
            let candidates = [];
            for (const sel of QUESTION_SELECTORS) {
                try {
                    const found = Array.from(document.querySelectorAll(sel)).filter(el => {
                        if (el.closest('#cloud-extractor-hud')) return false;
                        const t = el.textContent ? el.textContent.trim() : '';
                        return t.length >= 8 && t.length <= 5000;
                    });
                    if (found.length > 0) {
                        candidates = found;
                        break;
                    }
                } catch (e) {}
            }

            if (candidates.length === 0) {
                const pattern = /^(?:Question|Câu|Q|Bài)\\s*\\d+/i;
                const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, {
                    acceptNode(node) {
                        if (node.parentElement && node.parentElement.closest('#cloud-extractor-hud')) return NodeFilter.FILTER_REJECT;
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

            return candidates.filter((el, i, arr) => !arr.some((other, j) => i !== j && other !== el && other.contains(el)));
        }

        static extractIndex(el, orderIdx) {
            let rawIdx = el.getAttribute('data-index') || el.getAttribute('data-question-index') || el.getAttribute('data-question-id') || el.getAttribute('data-id') || (el.id && el.id.match(/\\d+/) ? el.id.match(/\\d+/)[0] : null);
            let source = 'data-attribute';

            if (!rawIdx) {
                const numEl = el.querySelector('.question-number, .number, .index, [class*="question-number"], [class*="qno"]');
                if (numEl && numEl.textContent.match(/\\d+/)) {
                    rawIdx = numEl.textContent.match(/\\d+/)[0];
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

            if (!rawIdx) return { index: orderIdx + 1, source: 'generated' };
            const num = Number(rawIdx);
            return { index: !isNaN(num) ? num : rawIdx.trim(), source: source };
        }

        static extractOptions(el) {
            let optEls = [];
            for (const sel of OPTION_SELECTORS) {
                const found = Array.from(el.querySelectorAll(sel));
                if (found.length > 0) { optEls = found; break; }
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

        static scan() {
            const containers = this.findContainers();
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

        static async transmit(questions) {
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

            try {
                await fetch(SAVE_ENDPOINT, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload)
                });
                console.log(\`%c[CLOUD EXTRACTOR] ✅ Đã gửi \${questions.length} câu hỏi về Cloud Dashboard!\`, 'color:#10b981;font-weight:bold;');
            } catch (e) {
                console.warn('[CLOUD EXTRACTOR] Không thể gửi dữ liệu về /api/save:', e.message);
            }
        }
    }

    /* Floating HUD */
    class CloudHUD {
        constructor() {
            this.hostId = 'cloud-extractor-hud';
            this.shadow = null;
            this.results = [];
        }

        init() {
            const old = document.getElementById(this.hostId);
            if (old) old.remove();

            const host = document.createElement('div');
            host.id = this.hostId;
            host.style.position = 'fixed';
            host.style.bottom = '16px';
            host.style.right = '16px';
            host.style.zIndex = '2147483647';
            host.style.fontFamily = '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';

            this.shadow = host.attachShadow({ mode: 'open' });
            this.shadow.innerHTML = \`
                <style>
                    * { box-sizing: border-box; margin: 0; padding: 0; }
                    .hud {
                        background: #0f172a;
                        color: #f8fafc;
                        border: 1px solid #334155;
                        border-radius: 10px;
                        box-shadow: 0 10px 25px rgba(0,0,0,0.6);
                        padding: 12px 14px;
                        font-size: 12px;
                        width: 240px;
                        transition: all 0.2s;
                    }
                    .hud.minimized .body { display: none; }
                    .hud.minimized { width: 140px; padding: 8px 10px; }
                    .header {
                        display: flex;
                        justify-content: space-between;
                        align-items: center;
                        font-weight: 700;
                        color: #38bdf8;
                    }
                    .btn-min {
                        background: none; border: none; color: #94a3b8; cursor: pointer; font-weight: bold;
                    }
                    .body { margin-top: 8px; }
                    .stat {
                        background: #1e293b; padding: 6px 8px; border-radius: 6px;
                        display: flex; justify-content: space-between; margin-bottom: 8px; font-size: 11.5px;
                    }
                    .btn-row { display: flex; gap: 6px; }
                    button.act {
                        flex: 1; padding: 5px; border-radius: 4px; border: none;
                        background: #0284c7; color: white; font-weight: 600; font-size: 11px; cursor: pointer;
                    }
                    button.act:hover { background: #0369a1; }
                    button.sec { background: #334155; }
                    button.sec:hover { background: #475569; }
                </style>
                <div class="hud" id="hud-box">
                    <div class="header">
                        <span>⚡ CLOUD PROXY</span>
                        <button class="btn-min" id="btn-min">_</button>
                    </div>
                    <div class="body">
                        <div class="stat">
                            <span style="color:#94a3b8;">Questions found:</span>
                            <strong id="hud-count" style="color:#4ade80;">0</strong>
                        </div>
                        <div class="btn-row">
                            <button class="act" id="btn-rescan">🔍 Rescan</button>
                            <button class="act sec" id="btn-copy">📋 Copy</button>
                        </div>
                    </div>
                </div>
            \`;

            document.body.appendChild(host);

            this.shadow.getElementById('btn-min').addEventListener('click', () => {
                this.shadow.getElementById('hud-box').classList.toggle('minimized');
            });
            this.shadow.getElementById('btn-rescan').addEventListener('click', () => this.runScan());
            this.shadow.getElementById('btn-copy').addEventListener('click', () => {
                navigator.clipboard.writeText(JSON.stringify(this.results, null, 2));
                alert(\`Copied \${this.results.length} questions to clipboard!\`);
            });

            this.runScan();
            this.setupObserver();
        }

        setupObserver() {
            let timer = null;
            const obs = new MutationObserver(() => {
                clearTimeout(timer);
                timer = setTimeout(() => this.runScan(), 600);
            });
            obs.observe(document.body, { childList: true, subtree: true });
        }

        async runScan() {
            this.results = DOMScanner.scan();
            const countEl = this.shadow.getElementById('hud-count');
            if (countEl) countEl.textContent = this.results.length;
            if (this.results.length > 0) {
                await DOMScanner.transmit(this.results);
            }
        }
    }

    // Tự động khởi tạo sau khi render
    setTimeout(() => {
        const hud = new CloudHUD();
        hud.init();
    }, 400);

    window.scanQuestions = () => DOMScanner.scan();
})();
`;
}

module.exports = { getInjectedClientScript };
