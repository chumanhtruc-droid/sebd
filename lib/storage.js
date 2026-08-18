/**
 * ==============================================================================
 * MODULE: STORAGE (Quản lý lưu trữ đề thi)
 * ==============================================================================
 */

const fs = require('fs');
const CONFIG = require('../config');

class ExamStorage {
    constructor() {
        this.ensureDataDir();
        this.cache = this.load();
    }

    ensureDataDir() {
        try {
            if (!fs.existsSync(CONFIG.DATA_DIR)) {
                fs.mkdirSync(CONFIG.DATA_DIR, { recursive: true });
            }
            if (!fs.existsSync(CONFIG.DATA_FILE)) {
                fs.writeFileSync(CONFIG.DATA_FILE, JSON.stringify([], null, 2), 'utf-8');
            }
        } catch (e) {
            console.error('[STORAGE] Error creating data directory:', e.message);
        }
    }

    load() {
        try {
            if (fs.existsSync(CONFIG.DATA_FILE)) {
                return JSON.parse(fs.readFileSync(CONFIG.DATA_FILE, 'utf-8'));
            }
        } catch (e) {}
        return [];
    }

    save(exam) {
        const item = {
            id: 'exam_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6),
            ...exam,
            receivedAt: new Date().toISOString()
        };

        this.cache.unshift(item);
        if (this.cache.length > 200) this.cache.pop(); // Giới hạn 200 bài mới nhất

        try {
            fs.writeFileSync(CONFIG.DATA_FILE, JSON.stringify(this.cache, null, 2), 'utf-8');
        } catch (e) {}

        return item;
    }

    getAll() {
        return this.cache;
    }

    getById(id) {
        return this.cache.find(e => e.id === id) || null;
    }

    delete(id) {
        const initialLen = this.cache.length;
        this.cache = this.cache.filter(e => e.id !== id);
        try {
            fs.writeFileSync(CONFIG.DATA_FILE, JSON.stringify(this.cache, null, 2), 'utf-8');
        } catch (e) {}
        return this.cache.length !== initialLen;
    }

    clear() {
        this.cache = [];
        try {
            fs.writeFileSync(CONFIG.DATA_FILE, JSON.stringify([], null, 2), 'utf-8');
        } catch (e) {}
    }
}

module.exports = new ExamStorage();
