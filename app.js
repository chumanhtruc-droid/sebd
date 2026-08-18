/**
 * ==============================================================================
 * INDEX EXTRACTOR - LOCAL PROXY & INJECTION SYSTEM ENTRYPOINT
 * ==============================================================================
 * Khởi chạy đồng thời:
 * 1. Local HTTP Proxy tại port 8080 (onBeforeResponse + Script Injection)
 * 2. Web Dashboard tại port 3000 (Giao diện điều khiển & Quản lý câu hỏi)
 * 
 * Lệnh chạy:
 *   node app.js
 * ==============================================================================
 */

const CONFIG = require('./src/config');
const Logger = require('./src/logger');
const proxyManager = require('./src/proxy-manager');
const dashboardServer = require('./src/dashboard/dashboard-server');

console.log('\n╔═══════════════════════════════════════════════════════════════════════════════╗');
console.log('║       ⚡ INDEX EXTRACTOR - LOCAL PROXY & SCRIPT INJECTION SYSTEM             ║');
console.log('╠═══════════════════════════════════════════════════════════════════════════════╣');
console.log(`║ 🛡️ Local Proxy Server   : http://${CONFIG.proxy.host}:${CONFIG.proxy.port} (onBeforeResponse)      ║`);
console.log(`║ 📊 Web Control Dashboard: http://localhost:${CONFIG.dashboard.port}                                ║`);
console.log('║ 🎯 Target Whitelist     : ' + CONFIG.ALLOWED_HOSTS.join(', ').padEnd(46) + '║');
console.log('╚═══════════════════════════════════════════════════════════════════════════════╝\n');

// 1. Khởi động Web Dashboard Server
dashboardServer.start();

// 2. Khởi động Local Proxy Manager
if (CONFIG.proxy.enabled) {
    proxyManager.start();
}
