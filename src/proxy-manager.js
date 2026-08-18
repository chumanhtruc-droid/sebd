/**
 * ==============================================================================
 * MODULE: PROXY MANAGER (Lifecycle & State Management)
 * ==============================================================================
 */

const http = require('http');
const CONFIG = require('./config');
const Logger = require('./logger');
const RequestHandler = require('./request-handler');

class ProxyManager {
    constructor() {
        this.server = null;
        this.isRunning = false;
        this.stats = {
            requests: 0,
            htmlResponses: 0,
            injected: 0,
            skipped: 0,
            questionsFound: 0
        };
        this.requestLogs = [];
        this.requestHandler = new RequestHandler(this);
    }

    addLog(text) {
        const time = Logger.formatTime();
        this.requestLogs.unshift(`${time} ${text}`);
        if (this.requestLogs.length > 50) {
            this.requestLogs.pop();
        }
    }

    getStats() {
        return {
            isRunning: this.isRunning,
            host: CONFIG.proxy.host,
            port: CONFIG.proxy.port,
            stats: this.stats,
            logs: this.requestLogs
        };
    }

    start() {
        if (this.isRunning) {
            Logger.warn('PROXY-MANAGER', 'Proxy is already running.');
            return;
        }

        this.server = http.createServer((req, res) => {
            this.requestHandler.handle(req, res);
        });

        const port = CONFIG.proxy.port || 8080;
        const host = CONFIG.proxy.host || '127.0.0.1';

        this.server.listen(port, host, () => {
            this.isRunning = true;
            Logger.proxy(`Local Proxy Server started on http://${host}:${port}`, 'green');
            this.addLog(`Proxy started on ${host}:${port}`);
        });

        this.server.on('error', (err) => {
            Logger.error('PROXY-MANAGER', `Proxy error: ${err.message}`);
            this.isRunning = false;
        });
    }

    stop() {
        if (!this.isRunning || !this.server) {
            Logger.warn('PROXY-MANAGER', 'Proxy is not running.');
            return;
        }

        this.server.close(() => {
            this.isRunning = false;
            Logger.proxy('Local Proxy Server stopped.', 'yellow');
            this.addLog('Proxy stopped');
        });
    }
}

module.exports = new ProxyManager();
