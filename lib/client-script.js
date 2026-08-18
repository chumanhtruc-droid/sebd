/**
 * ==============================================================================
 * MODULE: CLIENT-SIDE EXTRACTOR (Universal Class-Agnostic Parser)
 * ==============================================================================
 */

function getInjectedClientScript() {
    return `
(function () {
    'use strict';

    if (window.__UNIVERSAL_INDEX_EXTRACTOR_LOADED__) return;
    window.__UNIVERSAL_INDEX_EXTRACTOR_LOADED__ = true;

    console.log('%c[UNIVERSAL EXTRACTOR] ⚡ Lõi bóc tách tự động đa tầng đang hoạt động...', 'background:#2563eb;color:#fff;padding:3px 8px;border-radius:4px;font-weight:bold;');

    const SAVE_ENDPOINT = '/api/save';

    class UniversalHTMLParser {
        static clean(str) {
            if (!str) return '';
            return str.replace(/\\r\\n/g, '\\n').replace(/[ \\t]+/g, ' ').replace(/\\n\\s*\\n+/g, '\\n').trim();
        }

        static parseAnyHTML(rootElement = document.body) {
            const extracted = [];

            // =====================================================================
            // TẦNG 1: QUÉT NHÓM RADIO / CHECKBOX (Dạng form trắc nghiệm chuẩn)
            // =====================================================================
            const inputGroups = new Map();
            const inputs = Array.from(rootElement.querySelectorAll('input[type="radio"], input[type="checkbox"]'));
            
            inputs.forEach(inp => {
                const groupName = inp.name || inp.getAttribute('data-name') || 'default_group';
                if (!inputGroups.has(groupName)) inputGroups.set(groupName, []);
                inputGroups.get(groupName).push(inp);
            });

            inputGroups.forEach((groupInputs, name) => {
                if (groupInputs.length >= 2) {
                    let commonParent = groupInputs[0].parentElement;
                    while (commonParent && commonParent !== rootElement) {
                        const allInside = groupInputs.every(inp => commonParent.contains(inp));
                        if (allInside && commonParent.textContent.trim().length > 15) break;
                        commonParent = commonParent.parentElement;
                    }

                    if (commonParent && commonParent !== rootElement) {
                        const qData = this.extractFromContainer(commonParent, groupInputs);
                        if (qData) extracted.push(qData);
                    }
                }
            });

            // =====================================================================
            // TẦNG 2: QUÉT CÁC KHỐI VĂN BẢN (A., B., C., D. hoặc Câu 1, Câu 2)
            // =====================================================================
            if (extracted.length === 0) {
                const allBlocks = Array.from(rootElement.querySelectorAll('div, section, article, li, fieldset, tr, p, .card, .box'));
                
                allBlocks.forEach(block => {
                    if (block.closest('#universal-extractor-hud')) return;
                    const text = block.innerText || block.textContent || '';
                    if (text.length < 15 || text.length > 5000) return;

                    const optMatches = text.match(/(?:^|\\n)\\s*([A-Da-d0-9][\\.\\)])\\s+([^\\n]+)/g);
                    const isQuestionHeader = /^(?:Question|Câu|Q|Bài|Item)\\s*#?\\s*\\d+/i.test(text.trim());

                    if ((optMatches && optMatches.length >= 2) || isQuestionHeader) {
                        const hasChildCandidate = Array.from(block.children).some(child => {
                            const childTxt = child.innerText || child.textContent || '';
                            return /(?:^|\\n)\\s*([A-Da-d0-9][\\.\\)])\\s+/g.test(childTxt);
                        });

                        if (!hasChildCandidate || optMatches) {
                            const qData = this.extractFromText(text, block);
                            if (qData) extracted.push(qData);
                        }
                    }
                });
            }

            // =====================================================================
            // TẦNG 3: KHỬ TRÙNG LẶP & SẮP XẾP INDEX 1, 2, 3...
            // =====================================================================
            const uniqueMap = new Map();
            extracted.forEach((q, idx) => {
                const key = q.question.toLowerCase().trim();
                if (!uniqueMap.has(key)) {
                    if (!q.index) q.index = idx + 1;
                    uniqueMap.set(key, q);
                }
            });

            const results = Array.from(uniqueMap.values());
            results.sort((a, b) => (Number(a.index) || 0) - (Number(b.index) || 0));

            return results;
        }

        static extractFromContainer(container, inputElements = []) {
            const fullText = this.clean(container.innerText || container.textContent);
            
            let index = null;
            let indexSource = 'generated';
            const indexAttr = container.getAttribute('data-index') || container.getAttribute('data-id') || container.id;
            if (indexAttr && indexAttr.match(/\\d+/)) {
                index = Number(indexAttr.match(/\\d+/)[0]);
                indexSource = 'attribute';
            }

            const prefixMatch = fullText.match(/^(?:Question|Câu|Q|Bài|Item)\\s*#?\\s*(\\d+)[\\s.:-]*/i);
            if (prefixMatch) {
                index = Number(prefixMatch[1]);
                indexSource = 'text-prefix';
            }

            let options = [];
            if (inputElements.length > 0) {
                options = inputElements.map(inp => {
                    let labelText = '';
                    if (inp.id) {
                        const lbl = container.querySelector(\`label[for="\${inp.id}"]\`);
                        if (lbl) labelText = lbl.textContent;
                    }
                    if (!labelText && inp.parentElement) {
                        labelText = inp.parentElement.textContent;
                    }
                    return this.clean(labelText);
                }).filter(t => t.length > 0);
            }

            let questionText = fullText;
            options.forEach(opt => {
                if (opt) questionText = questionText.replace(opt, '');
            });
            questionText = questionText.replace(/^(?:Question|Câu|Q|Bài|Item)\\s*#?\\s*\\d+[\\s.:-]*/i, '').trim();

            if (!questionText || questionText.length < 3) return null;

            return {
                index: index || 1,
                questionId: (container.getAttribute('data-question-id') || container.getAttribute('data-id') || container.id || String(index || 1)),
                question: this.clean(questionText),
                options: options.length > 0 ? options : undefined,
                indexSource: indexSource
            };
        }

        static extractFromText(rawText, element) {
            const clean = this.clean(rawText);
            const lines = clean.split('\\n').map(l => l.trim()).filter(l => l.length > 0);
            if (lines.length === 0) return null;

            let index = 1;
            const prefixMatch = lines[0].match(/^(?:Question|Câu|Q|Bài|Item)\\s*#?\\s*(\\d+)[\\s.:-]*/i);
            if (prefixMatch) {
                index = Number(prefixMatch[1]);
            }

            const questionLines = [];
            const options = [];

            lines.forEach(line => {
                const isOption = /^([A-Da-d0-9][\\.\\)]|\\([A-Da-d0-9]\\))\\s+(.+)/i.test(line);
                if (isOption) {
                    options.push(line);
                } else if (options.length === 0) {
                    questionLines.push(line);
                }
            });

            let qText = questionLines.join(' ').replace(/^(?:Question|Câu|Q|Bài|Item)\\s*#?\\s*\\d+[\\s.:-]*/i, '').trim();
            if (!qText) qText = lines[0];

            return {
                index: index,
                questionId: String(index),
                question: qText,
                options: options.length > 0 ? options : undefined,
                indexSource: prefixMatch ? 'text-prefix' : 'generated'
            };
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
                console.log(\`%c[UNIVERSAL EXTRACTOR] ✅ Đã bóc & gửi thành công \${questions.length} câu hỏi!\`, 'color:#10b981;font-weight:bold;');
            } catch (e) {
                console.warn('[UNIVERSAL EXTRACTOR] Không thể gửi dữ liệu về Dashboard:', e.message);
            }
        }
    }

    /* =========================================================================
       GIAO DIỆN NỔI (HUD PANEL)
       ========================================================================= */
    class FloatingHUD {
        constructor() {
            this.hostId = 'universal-extractor-hud';
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

            const shadow = host.attachShadow({ mode: 'open' });
            shadow.innerHTML = \`
                <style>
                    * { box-sizing: border-box; margin: 0; padding: 0; }
                    .hud {
                        background: #0f172a; color: #f8fafc; border: 1px solid #334155;
                        border-radius: 10px; box-shadow: 0 10px 25px rgba(0,0,0,0.6);
                        padding: 12px 14px; font-size: 12px; width: 230px;
                    }
                    .hud.min .body { display: none; }
                    .hud.min { width: 130px; padding: 6px 10px; }
                    .hdr { display: flex; justify-content: space-between; align-items: center; font-weight: 700; color: #38bdf8; }
                    .btn-min { background: none; border: none; color: #94a3b8; cursor: pointer; font-weight: bold; }
                    .body { margin-top: 8px; }
                    .stat { background: #1e293b; padding: 6px 8px; border-radius: 6px; display: flex; justify-content: space-between; margin-bottom: 8px; font-size: 11.5px; }
                    .btn-row { display: flex; gap: 6px; }
                    button.act { flex: 1; padding: 5px; border-radius: 4px; border: none; background: #0284c7; color: white; font-weight: 600; font-size: 11px; cursor: pointer; }
                    button.act:hover { background: #0369a1; }
                    button.sec { background: #334155; }
                    button.sec:hover { background: #475569; }
                </style>
                <div class="hud" id="hud-box">
                    <div class="hdr">
                        <span>⚡ AUTO SCAN</span>
                        <button class="btn-min" id="btn-min">_</button>
                    </div>
                    <div class="body">
                        <div class="stat">
                            <span style="color:#94a3b8;">Đã bóc được:</span>
                            <strong id="hud-count" style="color:#4ade80;">0 câu</strong>
                        </div>
                        <div class="btn-row">
                            <button class="act" id="btn-rescan">🔍 Quét lại</button>
                            <button class="act sec" id="btn-copy">📋 Copy</button>
                        </div>
                    </div>
                </div>
            \`;

            document.body.appendChild(host);

            shadow.getElementById('btn-min').addEventListener('click', () => {
                shadow.getElementById('hud-box').classList.toggle('min');
            });
            shadow.getElementById('btn-rescan').addEventListener('click', () => this.runScan());
            shadow.getElementById('btn-copy').addEventListener('click', () => {
                navigator.clipboard.writeText(JSON.stringify(this.results, null, 2));
                alert(\`Đã copy \${this.results.length} câu hỏi vào clipboard!\`);
            });

            this.shadow = shadow;
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
            this.results = UniversalHTMLParser.parseAnyHTML(document.body);
            const countEl = this.shadow.getElementById('hud-count');
            if (countEl) countEl.textContent = \`\${this.results.length} câu\`;
            if (this.results.length > 0) {
                console.table(this.results);
                await UniversalHTMLParser.transmit(this.results);
            }
        }
    }

    // Tự động chạy ngay lập tức khi trang render
    setTimeout(() => {
        const hud = new FloatingHUD();
        hud.init();
    }, 300);

    window.scanQuestions = () => UniversalHTMLParser.parseAnyHTML(document.body);
})();
`;
}

module.exports = { getInjectedClientScript };
