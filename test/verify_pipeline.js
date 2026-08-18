/**
 * Verify End-to-End Pipeline
 */

const http = require('http');

async function testPipeline() {
    console.log('----------------------------------------------------');
    console.log('BẮT ĐẦU KIỂM THỬ PIPELINE ON_BEFORE_RESPONSE & INJECTION');
    console.log('----------------------------------------------------\n');

    // Gửi request tới Proxy (127.0.0.1:8080) với đích đến là Test Server (127.0.0.1:5000)
    const options = {
        hostname: '127.0.0.1',
        port: 8080,
        path: 'http://127.0.0.1:5000/',
        method: 'GET',
        headers: {
            'Host': '127.0.0.1:5000',
            'Accept-Encoding': 'gzip, deflate'
        }
    };

    const req = http.request(options, (res) => {
        console.log(`[TEST] HTTP Status nhận được qua Proxy: ${res.statusCode}`);
        console.log(`[TEST] Content-Type: ${res.headers['content-type']}`);
        console.log(`[TEST] Content-Encoding: ${res.headers['content-encoding']}`);
        console.log(`[TEST] Content-Length: ${res.headers['content-length']}`);

        const chunks = [];
        res.on('data', chunk => chunks.push(chunk));
        res.on('end', async () => {
            const buffer = Buffer.concat(chunks);
            const zlib = require('zlib');
            
            // Giải nén kết quả nếu còn nén gzip
            let bodyText = '';
            if (res.headers['content-encoding'] === 'gzip') {
                bodyText = zlib.gunzipSync(buffer).toString('utf-8');
            } else {
                bodyText = buffer.toString('utf-8');
            }

            const hasMarker = bodyText.includes('data-index-extractor="true"');
            const hasScanFunc = bodyText.includes('scanQuestions');

            console.log(`\n[TEST RESULT] Marker "data-index-extractor": ${hasMarker ? '✅ TÌM THẤY (ĐÃ INJECT THÀNH CÔNG)' : '❌ KHÔNG TÌM THẤY'}`);
            console.log(`[TEST RESULT] Client function "scanQuestions": ${hasScanFunc ? '✅ TỒN TẠI' : '❌ THIẾU'}`);

            if (hasMarker) {
                console.log('\n[TEST RESULT] 🌟 PIPELINE HOẠT ĐỘNG HOÀN TOÀN CHÍNH XÁC!\n');
            }
            process.exit(0);
        });
    });

    req.on('error', (e) => {
        console.error('[TEST ERROR] Không thể kết nối tới Proxy:', e.message);
        process.exit(1);
    });

    req.end();
}

testPipeline();
