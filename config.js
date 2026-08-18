/**
 * ==============================================================================
 * CLOUD REVERSE PROXY CONFIGURATION
 * ==============================================================================
 */

const path = require('path');

const CONFIG = {
    // Port do Render cung cấp qua biến môi trường (mặc định 10000 hoặc 3000)
    PORT: parseInt(process.env.PORT, 10) || 3000,
    HOST: '0.0.0.0',

    // URL website mục tiêu mặc định (có thể cấu hình qua Render Environment Variables)
    TARGET_URL: process.env.TARGET_URL || '',

    // Whitelist host cho phép proxy (nếu rỗng sẽ cho phép target cấu hình)
    ALLOWED_HOSTS: (process.env.ALLOWED_HOSTS || 'localhost,127.0.0.1,test.local').split(',').map(h => h.trim()),

    // Marker chống tiêm trùng lặp
    INJECTION_MARKER: 'data-index-extractor="cloud-v1"',

    // Đường dẫn lưu trữ dữ liệu
    DATA_DIR: path.join(__dirname, 'data'),
    DATA_FILE: path.join(__dirname, 'data', 'exams.json')
};

module.exports = CONFIG;
