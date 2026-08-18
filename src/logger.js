/**
 * ==============================================================================
 * MODULE: LOGGER
 * ==============================================================================
 */

const Logger = {
    colors: {
        reset: '\x1b[0m',
        blue: '\x1b[34m',
        cyan: '\x1b[36m',
        green: '\x1b[32m',
        yellow: '\x1b[33m',
        red: '\x1b[31m',
        magenta: '\x1b[35m',
        gray: '\x1b[90m'
    },

    formatTime() {
        const d = new Date();
        const hh = String(d.getHours()).padStart(2, '0');
        const mm = String(d.getMinutes()).padStart(2, '0');
        const ss = String(d.getSeconds()).padStart(2, '0');
        return `${hh}:${mm}:${ss}`;
    },

    log(tag, message, color = 'blue') {
        const c = this.colors[color] || this.colors.blue;
        const time = this.formatTime();
        console.log(`${this.colors.gray}[${time}]${this.colors.reset} ${c}[${tag}]${this.colors.reset} ${message}`);
    },

    proxy(message, color = 'cyan') {
        this.log('PROXY', message, color);
    },

    html(message, color = 'green') {
        this.log('HTML-INJECTOR', message, color);
    },

    json(message, color = 'magenta') {
        this.log('JSON-DETECTOR', message, color);
    },

    warn(tag, message) {
        this.log(tag, message, 'yellow');
    },

    error(tag, message) {
        this.log(tag, message, 'red');
    }
};

module.exports = Logger;
