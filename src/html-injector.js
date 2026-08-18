/**
 * ==============================================================================
 * MODULE: HTML INJECTOR & ENCODING HANDLER
 * ==============================================================================
 */

const zlib = require('zlib');
const fs = require('fs');
const path = require('path');
const CONFIG = require('./config');
const Logger = require('./logger');

class HtmlInjector {
    constructor() {
        this.clientScriptPath = path.join(__dirname, 'client', 'index-extractor.js');
        this.clientScriptCode = '';
        this.loadClientScript();
    }

    loadClientScript() {
        try {
            if (fs.existsSync(this.clientScriptPath)) {
                this.clientScriptCode = fs.readFileSync(this.clientScriptPath, 'utf-8');
            }
        } catch (e) {
            Logger.error('HTML-INJECTOR', 'Failed to load client script: ' + e.message);
        }
    }

    /**
     * Giải nén response body theo Content-Encoding
     */
    async decompressBody(buffer, encoding) {
        if (!buffer || buffer.length === 0) return buffer;
        const enc = (encoding || '').toLowerCase().trim();

        return new Promise((resolve, reject) => {
            if (enc === 'gzip') {
                zlib.gunzip(buffer, (err, decoded) => {
                    if (err) resolve(buffer); // Fallback giữ nguyên
                    else resolve(decoded);
                });
            } else if (enc === 'deflate') {
                zlib.inflate(buffer, (err, decoded) => {
                    if (err) {
                        // Thử inflateRaw
                        zlib.inflateRaw(buffer, (err2, decoded2) => {
                            if (err2) resolve(buffer);
                            else resolve(decoded2);
                        });
                    } else resolve(decoded);
                });
            } else if (enc === 'br') {
                zlib.brotliDecompress(buffer, (err, decoded) => {
                    if (err) resolve(buffer);
                    else resolve(decoded);
                });
            } else {
                // identity hoặc không nén
                resolve(buffer);
            }
        });
    }

    /**
     * Nén lại response body sau khi inject theo đúng encoding ban đầu
     */
    async compressBody(buffer, encoding) {
        const enc = (encoding || '').toLowerCase().trim();

        return new Promise((resolve) => {
            if (enc === 'gzip') {
                zlib.gzip(buffer, (err, encoded) => resolve(err ? buffer : encoded));
            } else if (enc === 'deflate') {
                zlib.deflate(buffer, (err, encoded) => resolve(err ? buffer : encoded));
            } else if (enc === 'br') {
                zlib.brotliCompress(buffer, (err, encoded) => resolve(err ? buffer : encoded));
            } else {
                resolve(buffer);
            }
        });
    }

    /**
     * Thực hiện kiểm tra và tiêm mã JavaScript vào HTML
     */
    async process(responseBuffer, headers) {
        const encoding = headers['content-encoding'] || 'identity';
        
        // 1. Giải nén buffer sang UTF-8 String
        const decompressedBuffer = await this.decompressBody(responseBuffer, encoding);
        let html = decompressedBuffer.toString('utf-8');

        // 2. Kiểm tra marker chống inject trùng lặp
        if (html.includes(CONFIG.INJECTION_MARKER)) {
            Logger.html('HTML already contains injection marker - skipped duplicate injection.');
            return {
                modified: false,
                bodyBuffer: responseBuffer,
                headers: headers
            };
        }

        // 3. Chuẩn bị Script Tag có gắn marker
        const scriptTag = `\n<!-- Index Extractor Auto Injected -->\n<script ${CONFIG.INJECTION_MARKER}>\n${this.clientScriptCode}\n</script>\n`;

        // 4. Tiêm script vào vị trí phù hợp
        if (html.includes('</body>')) {
            html = html.replace('</body>', `${scriptTag}</body>`);
            Logger.html('Injected script right before </body> tag.');
        } else if (html.includes('</html>')) {
            html = html.replace('</html>', `${scriptTag}</html>`);
            Logger.html('Injected script right before </html> tag.');
        } else {
            html = html + scriptTag;
            Logger.html('Appended script to the end of HTML response.');
        }

        // 5. Nén lại (nếu có encoding) hoặc trả về plain text
        const modifiedBuffer = Buffer.from(html, 'utf-8');
        const finalBuffer = await this.compressBody(modifiedBuffer, encoding);

        // 6. Cập nhật Content-Length header
        const updatedHeaders = { ...headers };
        updatedHeaders['content-length'] = Buffer.byteLength(finalBuffer);

        Logger.html('Injection successful. Updated Content-Length: ' + updatedHeaders['content-length']);

        return {
            modified: true,
            bodyBuffer: finalBuffer,
            headers: updatedHeaders
        };
    }
}

module.exports = new HtmlInjector();
