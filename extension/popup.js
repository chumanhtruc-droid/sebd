/**
 * Chrome Extension Popup Handler
 */

document.getElementById('btn-open-and-scrape').addEventListener('click', () => {
    const urlInput = document.getElementById('target-url').value.trim();
    if (!urlInput) {
        alert('Vui lòng nhập đường dẫn URL của website cần cào!');
        return;
    }

    let fullUrl = urlInput;
    if (!fullUrl.startsWith('http://') && !fullUrl.startsWith('https://')) {
        fullUrl = 'https://' + fullUrl;
    }

    chrome.runtime.sendMessage({
        action: 'OPEN_AND_SCRAPE',
        url: fullUrl
    }, (response) => {
        window.close();
    });
});

document.getElementById('btn-scrape-active').addEventListener('click', () => {
    const btn = document.getElementById('btn-scrape-active');
    btn.textContent = '⏳ Đang quét & gửi...';
    btn.disabled = true;

    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        if (!tabs || tabs.length === 0) return;
        
        chrome.tabs.sendMessage(tabs[0].id, { action: 'SCAN_AND_SEND' }, (response) => {
            btn.disabled = false;
            btn.textContent = '🔍 Bóc Tách Tab Hiện Tại & Gửi';

            if (chrome.runtime.lastError) {
                alert('Không thể kết nối với trang này (Có thể do trang đặc biệt của Chrome hoặc chưa tải xong). Hãy thử F5 lại trang!');
                return;
            }

            if (response && response.success) {
                alert(`✅ Thành công! Đã bóc ${response.count} câu hỏi và gửi về Server.`);
            } else {
                alert(`⚠️ Thông báo: ${(response && response.error) || 'Không tìm thấy câu hỏi.'}`);
            }
        });
    });
});

document.getElementById('btn-open-dashboard').addEventListener('click', () => {
    chrome.tabs.create({ url: 'http://localhost:3000' });
});
