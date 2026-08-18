/**
 * ==============================================================================
 * SAMPLE RECEIVER WEB SERVER (Node.js Built-in HTTP)
 * ==============================================================================
 * Web server đơn giản dùng để nhận dữ liệu câu hỏi được gửi từ Index Extractor.
 * Tự động ghi dữ liệu nhận được vào tệp 'received_questions.json'.
 * 
 * Cách chạy:
 *   node server_receiver.js
 * ==============================================================================
 */

const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = 3000;
const OUTPUT_FILE = path.join(__dirname, 'received_questions.json');

const server = http.createServer((req, res) => {
    // 1. Cấu hình Headers hỗ trợ CORS cho trình duyệt
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, x-api-key');

    // Xử lý Preflight CORS request
    if (req.method === 'OPTIONS') {
        res.writeHead(204);
        res.end();
        return;
    }

    // 2. Endpoint nhận dữ liệu POST /api/save
    if (req.method === 'POST' && req.url === '/api/save') {
        let body = '';

        req.on('data', chunk => {
            body += chunk.toString();
        });

        req.on('end', () => {
            try {
                const parsedData = JSON.parse(body);
                console.log('\n======================================================');
                console.log(`[RECEIVER] 📥 Đã nhận dữ liệu lúc: ${new Date().toLocaleTimeString()}`);
                console.log(`[RECEIVER] 📄 URL Nguồn: ${parsedData.metadata ? parsedData.metadata.sourceUrl : 'N/A'}`);
                console.log(`[RECEIVER] 📊 Tổng số câu hỏi: ${parsedData.questions ? parsedData.questions.length : 0}`);
                console.log('======================================================');

                // Lưu vào file JSON
                fs.writeFileSync(OUTPUT_FILE, JSON.stringify(parsedData, null, 2), 'utf-8');
                console.log(`[RECEIVER] 💾 Đã lưu thành công vào: ${OUTPUT_FILE}`);

                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({
                    status: 'success',
                    message: 'Dữ liệu câu hỏi đã được lưu thành công!',
                    receivedCount: parsedData.questions ? parsedData.questions.length : 0,
                    savedAt: new Date().toISOString()
                }));
            } catch (err) {
                console.error('[RECEIVER] ❌ Lỗi xử lý JSON:', err.message);
                res.writeHead(400, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ status: 'error', message: 'Invalid JSON payload' }));
            }
        });
        return;
    }

    // 3. Endpoint xem nhanh kết quả GET /
    if (req.method === 'GET' && req.url === '/') {
        let fileContent = 'Chưa có dữ liệu nào được gửi đến.';
        if (fs.existsSync(OUTPUT_FILE)) {
            fileContent = fs.readFileSync(OUTPUT_FILE, 'utf-8');
        }
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
        res.end(`
            <!DOCTYPE html>
            <html>
            <head>
                <meta charset="utf-8">
                <title>Dữ Liệu Đã Nhận</title>
                <style>
                    body { font-family: -apple-system, sans-serif; padding: 20px; background: #0f172a; color: #f8fafc; }
                    pre { background: #1e293b; padding: 15px; border-radius: 8px; overflow-x: auto; border: 1px solid #334155; }
                    h2 { color: #38bdf8; }
                </style>
            </head>
            <body>
                <h2>📥 Dữ Liệu Câu Hỏi Đã Nhận (Server Endpoint: http://localhost:${PORT}/api/save)</h2>
                <pre>${fileContent}</pre>
            </body>
            </html>
        `);
        return;
    }

    // Fallback 404
    res.writeHead(404, { 'Content-Type': 'text/plain' });
    res.end('Endpoint not found. Use POST /api/save');
});

server.listen(PORT, () => {
    console.log(`\n🚀 [RECEIVER SERVER] Đang lắng nghe tại: http://localhost:${PORT}`);
    console.log(`📡 Endpoint nhận dữ liệu: http://localhost:${PORT}/api/save`);
    console.log(`🌐 Mở trình duyệt xem dữ liệu tại: http://localhost:${PORT}/\n`);
});
