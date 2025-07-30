console.log('Background script starting...');

// Simple installation handler
chrome.runtime.onInstalled.addListener(() => {
    console.log('Extension installed');
});

console.log('Background script loaded successfully');