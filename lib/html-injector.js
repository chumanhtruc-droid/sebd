/**
 * ==============================================================================
 * MODULE: HTML INJECTOR (Giải nén & Tiêm mã JavaScript)
 * ==============================================================================
 */

const zlib = require('zlib');
const CONFIG = require('../config');
const { getInjectedClientScript } = require('./client-script');

class CloudHtmlInjector {
    async decompress(buffer, encoding) {
        if (!buffer || buffer.length === 0) return buffer;
        const enc = (encoding || '').toLowerCase().trim();

        return new Promise((resolve) => {
            if (enc === 'gzip') {
                zlib.gunzip(buffer, (err, decoded) => resolve(err ? buffer : decoded));
            } else if (enc === 'deflate') {
                zlib.inflate(buffer, (err, decoded) => {
                    if (err) {
                        zlib.inflateRaw(buffer, (err2, decoded2) => resolve(err2 ? buffer : decoded2));
                    } else resolve(decoded);
                });
            } else if (enc === 'br') {
                zlib.brotliDecompress(buffer, (err, decoded) => resolve(err ? buffer : decoded));
            } else {
                resolve(buffer);
            }
        });
    }

    async compress(buffer, encoding) {
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

    async inject(bodyBuffer, headers) {
        const encoding = headers['content-encoding'] || 'identity';
        const decompressed = await this.decompress(bodyBuffer, encoding);
        let html = decompressed.toString('utf-8');

        // Kiểm tra marker chống inject trùng
        if (html.includes(CONFIG.INJECTION_MARKER)) {
            return { modified: false, bodyBuffer, headers };
        }

        const scriptCode = getInjectedClientScript();
        const scriptTag = `\n<!-- Cloud Index Extractor Injected -->\n<script ${CONFIG.INJECTION_MARKER}>\n${scriptCode}\n</script>\n`;

        if (html.includes('</body>')) {
            html = html.replace('</body>', `${scriptTag}</body>`);
        } else if (html.includes('</html>')) {
            html = html.replace('</html>', `${scriptTag}</html>`);
        } else {
            html += scriptTag;
        }

        const modifiedBuffer = Buffer.from(html, 'utf-8');
        const finalBuffer = await this.compress(modifiedBuffer, encoding);

        const newHeaders = { ...headers };
        newHeaders['content-length'] = Buffer.byteLength(finalBuffer);

        return {
            modified: true,
            bodyBuffer: finalBuffer,
            headers: newHeaders
        };
    }
}

module.exports = new CloudHtmlInjector();
