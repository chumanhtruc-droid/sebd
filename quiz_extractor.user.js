// ==UserScript==
// @name         Auto Quiz Index Extractor & Server Transmitter
// @namespace    http://tampermonkey.net/
// @version      1.0
// @description  Tự động tìm và bóc tách câu hỏi trên trang thi rồi gửi về Dashboard Server http://localhost:3000
// @author       Antigravity
// @match        *://*/*quiz*
// @match        *://*/*exam*
// @match        *://*/*test*
// @match        *://*/*cau-hoi*
// @match        *://*/*de-thi*
// @match        *://*/*
// @grant        GM_xmlhttpRequest
// @run-at       document-idle
// ==/UserScript==

(function() {
    'use strict';
    
    // Tự động nhúng mã Extractor vào trang
    const script = document.createElement('script');
    script.src = 'http://localhost:3000/index_extractor.js';
    script.onerror = () => {
        console.warn('[USERSCRIPT] Không thể tải index_extractor.js từ localhost:3000. Hãy đảm bảo Server đang chạy.');
    };
    document.body.appendChild(script);
})();
