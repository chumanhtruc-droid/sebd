/**
 * ==============================================================================
 * MODULE: CONTENT-TYPE DETECTOR
 * ==============================================================================
 */

class ContentTypeDetector {
    /**
     * Phân tích chuỗi Content-Type từ HTTP Response Headers
     * @param {string} contentTypeHeader 
     */
    static parse(contentTypeHeader) {
        if (!contentTypeHeader || typeof contentTypeHeader !== 'string') {
            return {
                raw: '',
                mime: 'unknown',
                charset: 'utf-8',
                isHTML: false,
                isJSON: false,
                isStaticAsset: false
            };
        }

        const raw = contentTypeHeader.toLowerCase();
        const parts = raw.split(';').map(p => p.trim());
        const mime = parts[0];
        
        let charset = 'utf-8';
        const charsetPart = parts.find(p => p.startsWith('charset='));
        if (charsetPart) {
            charset = charsetPart.replace('charset=', '').trim();
        }

        const isHTML = mime === 'text/html';
        const isJSON = mime === 'application/json' || mime === 'text/json';
        const isStaticAsset = [
            'text/css',
            'application/javascript',
            'text/javascript',
            'image/',
            'font/',
            'audio/',
            'video/',
            'application/pdf',
            'application/octet-stream',
            'application/wasm'
        ].some(prefix => mime.startsWith(prefix));

        return {
            raw,
            mime,
            charset,
            isHTML,
            isJSON,
            isStaticAsset
        };
    }
}

module.exports = ContentTypeDetector;
