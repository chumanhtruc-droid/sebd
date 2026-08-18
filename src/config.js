/**
 * ==============================================================================
 * MODULE: CONFIGURATION
 * ==============================================================================
 */

const path = require('path');

const CONFIG = {
    // Cấu hình Proxy Server
    proxy: {
        host: '127.0.0.1',
        port: 8080,
        enabled: true,
        injectAll: true // Tự động quét và tiêm trên MỌI trang web
    },

    // Cấu hình Dashboard Web UI
    dashboard: {
        port: 3000,
        enabled: true
    },

    // Whitelist hoặc cho phép toàn bộ
    ALLOWED_HOSTS: ['*'],

    // Cấu hình các selector nhận diện câu hỏi
    selectors: {
        questions: [
            '.question',
            '.question-item',
            '.question-container',
            '.question-card',
            '.quiz-question',
            '.exam-question',
            '.test-question',
            '.que',
            '[data-question]',
            '[data-question-id]',
            '[data-index]',
            '[class*="question"]',
            '[id*="question"]'
        ],
        options: [
            '.option',
            '.option-item',
            '.answer',
            '.answer-item',
            '.choice',
            '.choice-item',
            '[data-option]',
            '[class*="option"]',
            '[class*="answer"]'
        ],
        noise: [
            'button',
            'script',
            'style',
            'svg',
            'noscript',
            '.btn',
            '.actions',
            '.tooltip',
            '.badge',
            '[aria-hidden="true"]',
            'input[type="radio"]',
            'input[type="checkbox"]'
        ],
        indexElements: [
            '.question-number',
            '.question-index',
            '.q-num',
            '.q-index',
            '.number',
            '.index',
            '[class*="question-number"]',
            '[class*="qno"]'
        ]
    },

    // Regex phát hiện tiền tố index ("Question 1", "Câu 15", "1.", etc.)
    questionPrefixRegexes: [
        /^(?:Question|Câu|Q|Item)\s*#?\s*(\d+)[\s.:-]*\s*/i,
        /^(\d+)[\s.:-]+\s*/i
    ],

    // Marker nhận diện đã inject để tránh trùng lặp
    INJECTION_MARKER: 'data-index-extractor="true"',

    // Đường dẫn lưu trữ dữ liệu
    DATA_FILE: path.join(__dirname, '..', 'data', 'exams.json')
};

module.exports = CONFIG;
