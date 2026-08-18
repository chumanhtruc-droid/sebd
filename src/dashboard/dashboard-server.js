/**
 * ==============================================================================
 * MODULE: DASHBOARD SERVER & WEB CONTROL PANEL
 * ==============================================================================
 */

const http = require('http');
const fs = require('fs');
const path = require('path');
const CONFIG = require('../config');
const Logger = require('../logger');
const proxyManager = require('../proxy-manager');

class DashboardServer {
    constructor() {
        this.server = null;
        this.port = CONFIG.dashboard.port || 3000;
        this.htmlPath = path.join(__dirname, 'index.html');
    }

    start() {
        this.server = http.createServer((req, res) => {
            const parsedUrl = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
            const pathname = parsedUrl.pathname;
            const method = req.method;

            res.setHeader('Access-Control-Allow-Origin', '*');
            res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
            res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

            if (method === 'OPTIONS') {
                res.writeHead(204);
                return res.end();
            }

            const sendJSON = (code, data) => {
                res.writeHead(code, { 'Content-Type': 'application/json; charset=utf-8' });
                res.end(JSON.stringify(data));
            };

            // 1. API Lấy thống kê Proxy & Logs
            if (pathname === '/api/proxy/stats' && method === 'GET') {
                return sendJSON(200, proxyManager.getStats());
            }

            // 2. API Bật Proxy
            if (pathname === '/api/proxy/start' && method === 'POST') {
                proxyManager.start();
                return sendJSON(200, { success: true, message: 'Proxy started' });
            }

            // 3. API Tắt Proxy
            if (pathname === '/api/proxy/stop' && method === 'POST') {
                proxyManager.stop();
                return sendJSON(200, { success: true, message: 'Proxy stopped' });
            }

            // 4. API Lưu dữ liệu câu hỏi từ client
            if (pathname === '/api/save' && method === 'POST') {
                let body = '';
                req.on('data', chunk => { body += chunk.toString(); });
                req.on('end', () => {
                    try {
                        const payload = JSON.parse(body);
                        const qCount = payload.questions ? payload.questions.length : 0;
                        proxyManager.stats.questionsFound += qCount;
                        proxyManager.addLog(`Received ${qCount} questions from ${payload.metadata?.sourceUrl || 'client'}`);

                        // Lưu vào file JSON
                        let exams = [];
                        if (fs.existsSync(CONFIG.DATA_FILE)) {
                            try { exams = JSON.parse(fs.readFileSync(CONFIG.DATA_FILE, 'utf-8')); } catch (e) {}
                        }
                        exams.unshift({
                            id: 'exam_' + Date.now(),
                            ...payload,
                            receivedAt: new Date().toISOString()
                        });
                        fs.writeFileSync(CONFIG.DATA_FILE, JSON.stringify(exams, null, 2), 'utf-8');

                        return sendJSON(200, { success: true, count: qCount });
                    } catch (e) {
                        return sendJSON(400, { error: 'Invalid JSON' });
                    }
                });
                return;
            }

            // 5. API Lấy danh sách câu hỏi đã lưu
            if (pathname === '/api/exams' && method === 'GET') {
                let exams = [];
                if (fs.existsSync(CONFIG.DATA_FILE)) {
                    try { exams = JSON.parse(fs.readFileSync(CONFIG.DATA_FILE, 'utf-8')); } catch (e) {}
                }
                return sendJSON(200, exams);
            }

            // 6. Phục vụ giao diện Dashboard HTML
            if (pathname === '/' || pathname === '/index.html') {
                fs.readFile(this.htmlPath, 'utf-8', (err, content) => {
                    if (err) {
                        res.writeHead(500, { 'Content-Type': 'text/plain' });
                        return res.end('Error loading dashboard UI');
                    }
                    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
                    res.end(content);
                });
                return;
            }

            res.writeHead(404, { 'Content-Type': 'text/plain' });
            res.end('Not Found');
        });

        this.server.listen(this.port, '0.0.0.0', () => {
            Logger.log('DASHBOARD', `Web Dashboard running at: http://localhost:${this.port}`, 'green');
        });
    }
}

module.exports = new DashboardServer();
