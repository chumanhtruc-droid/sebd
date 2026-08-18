/**
 * ==============================================================================
 * TEST WEB SERVER (Mô phỏng Website Thi Cử Local)
 * ==============================================================================
 * Chạy tại: http://127.0.0.1:5000
 * Hỗ trợ nén gzip để kiểm thử module giải nén & tiêm script của Proxy.
 */

const http = require('http');
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const PORT = 5000;
const HTML_FILE = path.join(__dirname, 'test_page.html');

const server = http.createServer((req, res) => {
    const url = req.url;

    // 1. Endpoint trả về JSON câu hỏi (để test JSON Detector)
    if (url === '/api/questions-json') {
        const jsonData = [
            {
                index: 10,
                questionId: "JSON_Q10",
                question: "Sprint Retrospective diễn ra khi nào?",
                options: ["Sau Sprint Review và trước Sprint Planning tiếp theo", "Đầu Sprint"]
            },
            {
                index: 11,
                questionId: "JSON_Q11",
                question: "Ai tham gia vào Daily Scrum?",
                options: ["Developers", "Chỉ Product Owner", "Khách hàng"]
            }
        ];

        res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
        return res.end(JSON.stringify(jsonData, null, 2));
    }

    // 2. Phục vụ trang HTML kiểm thử có nén GZIP
    fs.readFile(HTML_FILE, 'utf-8', (err, content) => {
        if (err) {
            res.writeHead(500, { 'Content-Type': 'text/plain' });
            return res.end('Error loading test page');
        }

        const acceptEncoding = req.headers['accept-encoding'] || '';

        // Nếu client hỗ trợ gzip, nén bằng gzip để test tính năng decompress của Proxy
        if (acceptEncoding.includes('gzip')) {
            zlib.gzip(Buffer.from(content, 'utf-8'), (gzipErr, gzipBuffer) => {
                if (gzipErr) {
                    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
                    return res.end(content);
                }
                res.writeHead(200, {
                    'Content-Type': 'text/html; charset=utf-8',
                    'Content-Encoding': 'gzip',
                    'Content-Length': gzipBuffer.length
                });
                res.end(gzipBuffer);
            });
        } else {
            res.writeHead(200, {
                'Content-Type': 'text/html; charset=utf-8',
                'Content-Length': Buffer.byteLength(content)
            });
            res.end(content);
        }
    });
});

server.listen(PORT, '127.0.0.1', () => {
    console.log(`[TEST SERVER] 🌐 Website đề thi mẫu đang chạy tại: http://127.0.0.1:${PORT}`);
});
