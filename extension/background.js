/**
 * Chrome Extension Background Service Worker
 */

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'OPEN_AND_SCRAPE') {
        const targetUrl = request.url;
        chrome.tabs.create({ url: targetUrl }, (tab) => {
            // Đợi tab load xong sẽ tự động kích hoạt bóc tách
            chrome.tabs.onUpdated.addListener(function listener(tabId, info) {
                if (tabId === tab.id && info.status === 'complete') {
                    chrome.tabs.onUpdated.removeListener(listener);
                    // Gửi tin nhắn cho content script trên tab đó tự động cào
                    setTimeout(() => {
                        chrome.tabs.sendMessage(tab.id, { action: 'TRIGGER_AUTO_SCAN_AND_SEND' });
                    }, 1000);
                }
            });
        });
        sendResponse({ success: true });
    }
    return true;
});
