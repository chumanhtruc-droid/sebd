/**
 * ==============================================================================
 * MODULE: RESPONSE HANDLER & ON_BEFORE_RESPONSE PIPELINE
 * ==============================================================================
 */

const CONFIG = require('./config');
const Logger = require('./logger');
const ContentTypeDetector = require('./content-type-detector');
const HtmlInjector = require('./html-injector');
const JsonDetector = require('./json-detector');

class ResponseHandler {
    /**
     * Kiểm tra quy tắc xem response có thỏa điều kiện để tiêm script không
     */
    static shouldInject(context) {
        const { hostname, statusCode, contentTypeInfo, bodyBuffer } = context;

        // 1. Kiểm tra whitelist host
        const isAllowedHost = CONFIG.ALLOWED_HOSTS.includes('*') || CONFIG.ALLOWED_HOSTS.some(h => {
            return hostname === h || hostname.startsWith(h + ':') || hostname === 'localhost' || hostname === '127.0.0.1';
        });

        if (!isAllowedHost) {
            Logger.proxy(`Host "${hostname}" not in allowed whitelist - skipped.`);
            return false;
        }

        // 2. Kiểm tra HTTP Status
        if (statusCode < 200 || statusCode >= 300) {
            return false;
        }

        // 3. Kiểm tra Content-Type
        if (!contentTypeInfo.isHTML) {
            return false;
        }

        // 4. Kiểm tra độ dài Body
        if (!bodyBuffer || bodyBuffer.length === 0) {
            return false;
        }

        return true;
    }

    /**
     * Callback onBeforeResponse: Xử lý response trước khi trả về client
     */
    static async onBeforeResponse(context) {
        const { req, res, statusCode, headers, bodyBuffer, url, hostname } = context;

        Logger.proxy(`Response received [${statusCode}] ${url}`);

        const contentTypeHeader = headers['content-type'] || '';
        const contentTypeInfo = ContentTypeDetector.parse(contentTypeHeader);

        Logger.proxy(`Content-Type: ${contentTypeInfo.raw || 'none'}`);

        context.contentTypeInfo = contentTypeInfo;

        // Xử lý quan sát thụ động nếu là JSON
        if (contentTypeInfo.isJSON) {
            const jsonStats = JsonDetector.inspect(bodyBuffer, url);
            return {
                modified: false,
                bodyBuffer: bodyBuffer,
                headers: headers,
                jsonStats: jsonStats,
                type: 'json'
            };
        }

        // Kiểm tra điều kiện Inject
        Logger.proxy('Checking injection rule...');
        const canInject = this.shouldInject(context);

        if (!canInject) {
            if (!contentTypeInfo.isHTML) {
                Logger.proxy('Non-HTML response - skipped.');
            }
            return {
                modified: false,
                bodyBuffer: bodyBuffer,
                headers: headers,
                type: 'skipped'
            };
        }

        Logger.proxy('HTML detected. Injecting Index Extractor...');

        try {
            // Tiêm script vào HTML
            const injectionResult = await HtmlInjector.process(bodyBuffer, headers);
            return {
                modified: injectionResult.modified,
                bodyBuffer: injectionResult.bodyBuffer,
                headers: injectionResult.headers,
                type: injectionResult.modified ? 'injected' : 'skipped'
            };
        } catch (err) {
            Logger.error('RESPONSE-HANDLER', 'Error during injection: ' + err.message);
            return {
                modified: false,
                bodyBuffer: bodyBuffer,
                headers: headers,
                type: 'error'
            };
        }
    }
}

module.exports = ResponseHandler;
