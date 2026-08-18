/**
 * ==============================================================================
 * MODULE: REQUEST HANDLER & FORWARDING PROXY
 * ==============================================================================
 */

const http = require('http');
const https = require('https');
const url = require('url');
const Logger = require('./logger');
const ResponseHandler = require('./response-handler');

class RequestHandler {
    constructor(proxyManager) {
        this.proxyManager = proxyManager;
    }

    /**
     * Xử lý HTTP Request từ client
     */
    handle(clientReq, clientRes) {
        this.proxyManager.stats.requests++;

        const clientUrl = clientReq.url;
        const method = clientReq.method;

        Logger.proxy(`Request received [${method}] ${clientUrl}`);
        this.proxyManager.addLog(`${method} ${clientUrl}`);

        // Xử lý API cục bộ (Lưu câu hỏi bóc được hoặc lấy stats)
        if (clientUrl === '/api/save' && method === 'POST') {
            return this.handleLocalSave(clientReq, clientRes);
        }
        if (clientUrl === '/api/stats' && method === 'GET') {
            return this.handleLocalStats(clientReq, clientRes);
        }

        let targetHostname = '';
        let targetPort = 80;
        let targetPath = clientUrl;

        // Phân tích URL đích
        if (clientUrl.startsWith('http://') || clientUrl.startsWith('https://')) {
            const parsed = new URL(clientUrl);
            targetHostname = parsed.hostname;
            targetPort = parsed.port || (parsed.protocol === 'https:' ? 443 : 80);
            targetPath = parsed.pathname + parsed.search;
        } else {
            const hostHeader = clientReq.headers['host'] || '127.0.0.1';
            const hostParts = hostHeader.split(':');
            targetHostname = hostParts[0];
            targetPort = hostParts[1] ? parseInt(hostParts[1], 10) : 80;
        }

        const forwardHeaders = { ...clientReq.headers };
        // Không nhận gzip nếu muốn proxy xử lý nhanh, hoặc giữ nguyên để test zlib decompress
        // forwardHeaders['accept-encoding'] = 'gzip, deflate, identity';

        const forwardOptions = {
            hostname: targetHostname,
            port: targetPort,
            path: targetPath,
            method: method,
            headers: forwardHeaders
        };

        const requester = targetPort === 443 ? https : http;

        const proxyReq = requester.request(forwardOptions, (proxyRes) => {
            const responseChunks = [];

            proxyRes.on('data', chunk => {
                responseChunks.push(chunk);
            });

            proxyRes.on('end', async () => {
                const rawBuffer = Buffer.concat(responseChunks);

                // Kích hoạt onBeforeResponse pipeline
                const context = {
                    req: clientReq,
                    res: clientRes,
                    statusCode: proxyRes.statusCode,
                    headers: proxyRes.headers,
                    bodyBuffer: rawBuffer,
                    url: clientUrl,
                    hostname: targetHostname
                };

                const result = await ResponseHandler.onBeforeResponse(context);

                // Cập nhật thống kê Proxy Manager
                if (result.type === 'injected') {
                    this.proxyManager.stats.injected++;
                    this.proxyManager.stats.htmlResponses++;
                    this.proxyManager.addLog(`HTML response -> Script injected`);
                } else if (result.type === 'skipped') {
                    this.proxyManager.stats.skipped++;
                } else if (result.type === 'json') {
                    if (result.jsonStats && result.jsonStats.detected) {
                        this.proxyManager.stats.questionsFound += result.jsonStats.totalQuestions;
                    }
                }

                // Gửi response về client
                clientRes.writeHead(proxyRes.statusCode, result.headers);
                clientRes.end(result.bodyBuffer);
            });
        });

        proxyReq.on('error', (err) => {
            Logger.error('REQUEST-HANDLER', `Proxy forward error for ${clientUrl}: ${err.message}`);
            clientRes.writeHead(502, { 'Content-Type': 'text/plain; charset=utf-8' });
            clientRes.end(`502 Bad Gateway (Local Proxy Error): ${err.message}`);
        });

        clientReq.pipe(proxyReq, { end: true });
    }

    handleLocalSave(req, res) {
        let body = '';
        req.on('data', chunk => { body += chunk.toString(); });
        req.on('end', () => {
            try {
                const data = JSON.parse(body);
                const qCount = data.questions ? data.questions.length : 0;
                this.proxyManager.stats.questionsFound += qCount;
                this.proxyManager.addLog(`Saved ${qCount} questions from ${data.metadata?.sourceUrl || 'page'}`);
                
                res.writeHead(200, {
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': '*'
                });
                res.end(JSON.stringify({ success: true, count: qCount }));
            } catch (e) {
                res.writeHead(400, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: 'Invalid JSON' }));
            }
        });
    }

    handleLocalStats(req, res) {
        res.writeHead(200, {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*'
        });
        res.end(JSON.stringify(this.proxyManager.getStats()));
    }
}

module.exports = RequestHandler;
