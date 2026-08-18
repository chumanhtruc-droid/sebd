/**
 * ==============================================================================
 * CLOUD REVERSE PROXY & HTML INJECTOR SERVER (RENDER READY)
 * ==============================================================================
 * Deployable on Render Web Service:
 * - Reverse Proxy with OnBeforeResponse Interceptor
 * - Automatic HTML Decompression & Script Injection
 * - Embedded Storage & Control Dashboard
 * 
 * Lệnh chạy:
 *   node server.js
 * ==============================================================================
 */

const http = require('http');
const fs = require('fs');
const path = require('path');
const CONFIG = require('./config');
const storage = require('./lib/storage');
const reverseProxy = require('./lib/reverse-proxy');

const DASHBOARD_FILE = path.join(__dirname, 'public', 'dashboard.html');

const server = http.createServer((req, res) => {
    const parsedUrl = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
    const pathname = parsedUrl.pathname;
    const method = req.method;

    // 1. CORS Headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    if (method === 'OPTIONS') {
        res.writeHead(204);
        return res.end();
    }

    const sendJSON = (statusCode, data) => {
        res.writeHead(statusCode, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify(data));
    };

    // 2. API Lưu dữ liệu câu hỏi từ script tiêm
    if (pathname === '/api/save' && method === 'POST') {
        let body = '';
        req.on('data', chunk => { body += chunk.toString(); });
        req.on('end', () => {
            try {
                const payload = JSON.parse(body);
                const saved = storage.save(payload);
                console.log(`[SERVER] 📥 Đã nhận và lưu ${saved.questions?.length || 0} câu hỏi từ "${saved.metadata?.pageTitle || 'N/A'}"`);
                return sendJSON(200, { success: true, id: saved.id, count: saved.questions?.length || 0 });
            } catch (e) {
                return sendJSON(400, { error: 'Invalid JSON payload' });
            }
        });
        return;
    }

    // 3. API Lấy danh sách đề thi
    if (pathname === '/api/exams' && method === 'GET') {
        return sendJSON(200, storage.getAll());
    }

    // 4. API Lấy chi tiết đề thi theo ID
    if (pathname.startsWith('/api/exams/') && method === 'GET') {
        const id = pathname.replace('/api/exams/', '');
        const item = storage.getById(id);
        if (!item) return sendJSON(404, { error: 'Exam not found' });
        return sendJSON(200, item);
    }

    // 5. API Xóa đề thi
    if (pathname.startsWith('/api/exams/') && method === 'DELETE') {
        const id = pathname.replace('/api/exams/', '');
        const deleted = storage.delete(id);
        return sendJSON(200, { success: deleted });
    }

    // 6. Route Reverse Proxy động: /proxy?url=https://target.com...
    if (pathname === '/proxy') {
        const targetUrl = parsedUrl.searchParams.get('url');
        if (!targetUrl) {
            res.writeHead(400, { 'Content-Type': 'text/plain; charset=utf-8' });
            return res.end('400 Bad Request: Missing "url" parameter. Example: /proxy?url=https://example.com');
        }
        return reverseProxy.handle(req, res, targetUrl);
    }

    // 7. Route Reverse Proxy mặc định nếu có TARGET_URL trong env
    if (CONFIG.TARGET_URL && pathname !== '/' && pathname !== '/dashboard') {
        const targetUrl = new URL(pathname + parsedUrl.search, CONFIG.TARGET_URL).toString();
        return reverseProxy.handle(req, res, targetUrl);
    }

    // 8. Phục vụ Web Dashboard (GET / hoặc GET /dashboard)
    if (pathname === '/' || pathname === '/dashboard') {
        fs.readFile(DASHBOARD_FILE, 'utf-8', (err, content) => {
            if (err) {
                res.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' });
                return res.end('500 Error: Dashboard UI file not found.');
            }
            res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
            res.end(content);
        });
        return;
    }

    // 9. Fallback 404
    res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('404 Not Found - Check dashboard at /');
});

server.listen(CONFIG.PORT, CONFIG.HOST, () => {
    console.log('\n╔═══════════════════════════════════════════════════════════════════════════════╗');
    console.log('║        🚀 CLOUD REVERSE PROXY & HTML INJECTOR IS RUNNING ON RENDER            ║');
    console.log('╠═══════════════════════════════════════════════════════════════════════════════╣');
    console.log(`║ 🌐 Cloud Dashboard    : http://${CONFIG.HOST}:${CONFIG.PORT}/                           ║`);
    console.log(`║ 🛡️ Reverse Proxy Route: http://${CONFIG.HOST}:${CONFIG.PORT}/proxy?url=https://...       ║`);
    console.log(`║ 📡 Data Ingestion API : http://${CONFIG.HOST}:${CONFIG.PORT}/api/save                   ║`);
    if (CONFIG.TARGET_URL) {
        console.log(`║ 🎯 Fixed Target URL   : ${CONFIG.TARGET_URL.padEnd(54)}║`);
    }
    console.log('╚═══════════════════════════════════════════════════════════════════════════════╝\n');
});
