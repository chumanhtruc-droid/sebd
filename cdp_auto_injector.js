/**
 * ==============================================================================
 * AUTO WEBVIEW & APP INJECTOR (CDP Daemon)
 * ==============================================================================
 * Mục đích:
 * Tự động theo dõi khi ứng dụng (App/Electron/WebView2/Chromium) khởi động,
 * tự động tìm trang web đang chạy bên trong App đó và tiêm (inject) script bóc tách.
 * 
 * Cách hoạt động:
 * 1. App được khởi động với cổng debug (mặc định: 9222).
 * 2. Script này liên tục quét cổng 9222 để phát hiện trang web đang mở trong App.
 * 3. Ngay khi App mở trang web, script tự động thực thi bóc tách và gửi về localhost:3000.
 * ==============================================================================
 */

const http = require('http');
const fs = require('fs');
const path = require('path');

const DEBUG_PORT = 9222;
const EXTRACTOR_SCRIPT_PATH = path.join(__dirname, 'public', 'index_extractor.js');
const CHECK_INTERVAL_MS = 2000;

console.log('\n╔═════════════════════════════════════════════════════════════════╗');
console.log('║       🤖 AUTO APP & WEBVIEW WATCHER & INJECTOR ĐANG CHẠY!       ║');
console.log('╠═════════════════════════════════════════════════════════════════╣');
console.log(`║ 🔍 Đang quét ứng dụng tại cổng debug: http://127.0.0.1:${DEBUG_PORT}   ║`);
console.log(`║ 📡 Tự động gửi kết quả về Server   : http://localhost:3000/api/save ║`);
console.log('╚═════════════════════════════════════════════════════════════════╝\n');

// Đọc mã nguồn script extractor
let extractorCode = '';
if (fs.existsSync(EXTRACTOR_SCRIPT_PATH)) {
    extractorCode = fs.readFileSync(EXTRACTOR_SCRIPT_PATH, 'utf-8');
} else {
    extractorCode = fs.readFileSync(path.join(__dirname, 'index_extractor.js'), 'utf-8');
}

const injectedTabs = new Set();

async function checkAndInject() {
    try {
        // Lấy danh sách các trang web / webview đang mở trong App
        const response = await fetch(`http://127.0.0.1:${DEBUG_PORT}/json/list`, { signal: AbortSignal.timeout(1500) });
        if (!response.ok) return;

        const targets = await response.json();
        const pageTargets = targets.filter(t => t.type === 'page' || t.type === 'webview' || t.type === 'app');

        for (const target of pageTargets) {
            const tabId = target.id;
            const targetUrl = target.url || '';

            // Bỏ qua các trang nội bộ của browser
            if (targetUrl.startsWith('chrome://') || targetUrl.startsWith('devtools://')) continue;

            // Nếu trang mới hoặc vừa đổi URL
            if (!injectedTabs.has(tabId)) {
                console.log(`\n[AUTO-INJECTOR] 🎯 Phát hiện App đang mở trang web: "${target.title || targetUrl}"`);
                console.log(`[AUTO-INJECTOR] 🌐 URL: ${targetUrl}`);

                // Tiêm script vào App qua CDP (Chrome DevTools Protocol)
                if (target.webSocketDebuggerUrl) {
                    await injectViaWebSocket(target.webSocketDebuggerUrl, extractorCode);
                    injectedTabs.add(tabId);
                    console.log(`[AUTO-INJECTOR] ✅ Đã tiêm mã bóc tách vào App thành công!\n`);
                }
            }
        }
    } catch (e) {
        // App chưa mở hoặc cổng 9222 chưa sẵn sàng -> tiếp tục chờ
    }
}

/**
 * Gửi lệnh thực thi JavaScript vào Webview của App qua giao thức WebSocket CDP
 */
function injectViaWebSocket(wsUrl, scriptCode) {
    return new Promise((resolve) => {
        try {
            // Dùng WebSocket client có sẵn trong Node.js 22+ hoặc fallback http
            const WebSocketClient = globalThis.WebSocket || require('ws');
            const ws = new WebSocketClient(wsUrl);

            ws.onopen = () => {
                const message = {
                    id: 1,
                    method: 'Runtime.evaluate',
                    params: {
                        expression: scriptCode,
                        userGesture: true,
                        awaitPromise: true
                    }
                };
                ws.send(JSON.stringify(message));
            };

            ws.onmessage = (event) => {
                try {
                    const data = JSON.parse(event.data);
                    if (data.id === 1) {
                        ws.close();
                        resolve(true);
                    }
                } catch (err) {
                    resolve(false);
                }
            };

            ws.onerror = () => resolve(false);
            setTimeout(() => {
                try { ws.close(); } catch (e) {}
                resolve(false);
            }, 3000);
        } catch (err) {
            resolve(false);
        }
    });
}

// Chạy vòng lặp quét liên tục
setInterval(checkAndInject, CHECK_INTERVAL_MS);
checkAndInject();
