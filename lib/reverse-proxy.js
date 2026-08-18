/**
 * ==============================================================================
 * MODULE: REVERSE PROXY & RESPONSE INTERCEPTOR
 * ==============================================================================
 */

const http = require('http');
const https = require('https');
const url = require('url');
const htmlInjector = require('./html-injector');
const CONFIG = require('../config');

class ReverseProxyHandler {
    /**
     * Chuyển tiếp request đến Target Server và can thiệp Response
     */
    static handle(clientReq, clientRes, targetUrlString) {
        let targetParsed;
        try {
            targetParsed = new URL(targetUrlString);
        } catch (e) {
            clientRes.writeHead(400, { 'Content-Type': 'text/plain; charset=utf-8' });
            return clientRes.end('400 Bad Request: Invalid Target URL.');
        }

        const isHttps = targetParsed.protocol === 'https:';
        const requester = isHttps ? https : http;

        // Chuẩn bị headers chuyển tiếp
        const forwardHeaders = { ...clientReq.headers };
        forwardHeaders['host'] = targetParsed.host;
        // Bỏ cookie nhạy cảm / hop-by-hop headers nếu không cần thiết
        delete forwardHeaders['connection'];

        const forwardOptions = {
            hostname: targetParsed.hostname,
            port: targetParsed.port || (isHttps ? 443 : 80),
            path: targetParsed.pathname + targetParsed.search,
            method: clientReq.method,
            headers: forwardHeaders
        };

        console.log(`[PROXY] 🌐 [${clientReq.method}] Forwarding to: ${targetUrlString}`);

        const proxyReq = requester.request(forwardOptions, (proxyRes) => {
            const chunks = [];

            proxyRes.on('data', chunk => { chunks.push(chunk); });

            proxyRes.on('end', async () => {
                const bodyBuffer = Buffer.concat(chunks);
                const statusCode = proxyRes.statusCode;
                const contentType = proxyRes.headers['content-type'] || '';
                const isHTML = contentType.toLowerCase().includes('text/html');

                console.log(`[PROXY] 📥 Response [${statusCode}] Content-Type: ${contentType}`);

                let finalBuffer = bodyBuffer;
                let finalHeaders = { ...proxyRes.headers };

                // Cho phép CORS
                finalHeaders['access-control-allow-origin'] = '*';
                finalHeaders['access-control-allow-methods'] = 'GET, POST, OPTIONS';
                finalHeaders['access-control-allow-headers'] = '*';

                // Xóa CSP nghiêm ngặt của web gốc để script inject hoạt động
                delete finalHeaders['content-security-policy'];
                delete finalHeaders['content-security-policy-report-only'];

                // Nếu là trang HTML và status 200 -> Kích hoạt tiêm script
                if (isHTML && statusCode >= 200 && statusCode < 300 && bodyBuffer.length > 0) {
                    try {
                        console.log('[PROXY] ⚡ HTML detected. Injecting Index Extractor script...');
                        const result = await htmlInjector.inject(bodyBuffer, finalHeaders);
                        finalBuffer = result.bodyBuffer;
                        finalHeaders = result.headers;
                        console.log(`[PROXY] ✅ Injected successfully. Size: ${finalBuffer.length} bytes.`);
                    } catch (injErr) {
                        console.error('[PROXY] ❌ Injection error:', injErr.message);
                    }
                }

                clientRes.writeHead(statusCode, finalHeaders);
                clientRes.end(finalBuffer);
            });
        });

        proxyReq.on('error', (err) => {
            console.error(`[PROXY] ❌ Connection error to ${targetUrlString}:`, err.message);
            clientRes.writeHead(502, { 'Content-Type': 'text/plain; charset=utf-8' });
            clientRes.end(`502 Bad Gateway: Không thể kết nối tới Target Website (${err.message})`);
        });

        // Chuyển tiếp body nếu có (POST, PUT)
        clientReq.pipe(proxyReq, { end: true });
    }
}

module.exports = ReverseProxyHandler;
