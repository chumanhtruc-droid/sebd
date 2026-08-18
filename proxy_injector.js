/**
 * ==============================================================================
 * LOCAL HTML PROXY INJECTOR (Tự Động Tiêm Mã Vào Mọi Trang Web App Tải Về)
 * ==============================================================================
 * Dành cho trường hợp: App gọi nội dung từ web nhưng không thể bật cổng Debug.
 * Hoạt động:
 * 1. Chạy một HTTP Proxy tại cổng 8080.
 * 2. Khi App gửi request tải trang web thi về, Proxy tự động chèn script bóc tách
 *    vào mã nguồn HTML trước khi trả về cho App hiển thị.
 * 3. Khi App mở trang lên, mã bóc tách tự động chạy và gửi câu hỏi về localhost:3000.
 * ==============================================================================
 */

const http = require('http');
const httpProxy = require('http');

const PROXY_PORT = 8080;
const SCRIPT_TAG = `<script src="http://localhost:3000/index_extractor.js"></script>`;

const server = http.createServer((clientReq, clientRes) => {
    const parsedUrl = new URL(clientReq.url, `http://${clientReq.headers.host}`);

    const options = {
        hostname: parsedUrl.hostname,
        port: parsedUrl.port || 80,
        path: parsedUrl.pathname + parsedUrl.search,
        method: clientReq.method,
        headers: {
            ...clientReq.headers,
            'accept-encoding': 'identity' // Yêu cầu server web không nén gzip để proxy có thể sửa HTML
        }
    };

    const proxyReq = http.request(options, (proxyRes) => {
        const contentType = proxyRes.headers['content-type'] || '';

        // Nếu là trang HTML, tự động tiêm thẻ script vào trước thẻ đóng </body>
        if (contentType.includes('text/html')) {
            let body = '';
            proxyRes.on('data', chunk => { body += chunk.toString(); });
            proxyRes.on('end', () => {
                if (body.includes('</body>')) {
                    body = body.replace('</body>', `${SCRIPT_TAG}</body>`);
                } else {
                    body += SCRIPT_TAG;
                }

                const headers = { ...proxyRes.headers };
                delete headers['content-length']; // Cập nhật lại độ dài nội dung

                clientRes.writeHead(proxyRes.statusCode, headers);
                clientRes.end(body);
                console.log(`[PROXY] ⚡ Đã tự động tiêm mã bóc tách vào: ${clientReq.url}`);
            });
        } else {
            // Với hình ảnh, css, js khác thì chuyển tiếp bình thường
            clientRes.writeHead(proxyRes.statusCode, proxyRes.headers);
            proxyRes.pipe(clientRes, { end: true });
        }
    });

    proxyReq.on('error', (err) => {
        clientRes.writeHead(502);
        clientRes.end('Proxy Error: ' + err.message);
    });

    clientReq.pipe(proxyReq, { end: true });
});

server.listen(PROXY_PORT, () => {
    console.log(`\n🚀 [PROXY INJECTOR] Đang chạy tại cổng: http://127.0.0.1:${PROXY_PORT}`);
    console.log(`💡 Hãy cấu hình HTTP Proxy của App hoặc Windows trỏ về: 127.0.0.1:${PROXY_PORT}\n`);
});
