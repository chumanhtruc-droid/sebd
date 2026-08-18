/**
 * ==============================================================================
 * MODULE: JSON DETECTOR (Debug-Only Passive Observer)
 * ==============================================================================
 */

const Logger = require('./logger');

class JsonDetector {
    /**
     * Phân tích cấu trúc JSON để phát hiện dữ liệu câu hỏi
     * @param {Buffer|string} jsonBuffer 
     * @param {string} url 
     */
    static inspect(jsonBuffer, url) {
        try {
            const rawStr = jsonBuffer.toString('utf-8');
            const data = JSON.parse(rawStr);

            const questions = [];
            this.traverseObject(data, questions, 0);

            if (questions.length > 0) {
                const indexes = questions.filter(q => q.index !== undefined);
                Logger.json(`[JSON DETECTED] URL: ${url} | Questions: ${questions.length} | Indexes found: ${indexes.length}`);
                return {
                    detected: true,
                    totalQuestions: questions.length,
                    totalIndexes: indexes.length,
                    questions: questions
                };
            }
        } catch (e) {
            // Không phải JSON hợp lệ
        }

        return { detected: false, totalQuestions: 0, totalIndexes: 0, questions: [] };
    }

    static traverseObject(obj, results, depth) {
        if (!obj || typeof obj !== 'object' || depth > 4) return;

        if (Array.isArray(obj)) {
            if (obj.length > 0 && typeof obj[0] === 'object' && obj[0] !== null) {
                const sample = obj[0];
                const keys = Object.keys(sample).map(k => k.toLowerCase());
                const isQuestion = keys.some(k => k.includes('question') || k.includes('content') || k.includes('title'))
                                && (keys.some(k => k.includes('index') || k.includes('id') || k.includes('option') || k.includes('answer')));

                if (isQuestion) {
                    obj.forEach((item, idx) => {
                        results.push({
                            index: item.index || item.questionIndex || item.no || (idx + 1),
                            questionId: item.questionId || item.id || String(idx + 1),
                            question: item.question || item.content || item.title || '',
                            options: item.options || item.answers || []
                        });
                    });
                    return;
                }
            }
        }

        for (const key of Object.keys(obj)) {
            if (typeof obj[key] === 'object' && obj[key] !== null) {
                this.traverseObject(obj[key], results, depth + 1);
            }
        }
    }
}

module.exports = JsonDetector;
