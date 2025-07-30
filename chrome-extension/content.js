// content.js - Runs on LinkedIn profile pages
console.log('🔗 LinkedIn Profile Scraper content script loaded');

// Add visual indicator when extension is active
function addExtensionIndicator() {
    // Remove existing indicator
    const existing = document.getElementById('linkedin-scraper-indicator');
    if (existing) existing.remove();
    
    const indicator = document.createElement('div');
    indicator.id = 'linkedin-scraper-indicator';
    indicator.innerHTML = `
        <div style="
            position: fixed;
            top: 20px;
            right: 20px;
            background: linear-gradient(135deg, #0077b5 0%, #00a0dc 100%);
            color: white;
            padding: 12px 16px;
            border-radius: 25px;
            font-size: 13px;
            font-weight: 600;
            z-index: 10000;
            box-shadow: 0 4px 20px rgba(0,119,181,0.4);
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            backdrop-filter: blur(10px);
            border: 1px solid rgba(255,255,255,0.2);
            animation: slideIn 0.5s ease-out;
        ">
            <span style="margin-right: 8px;">🔗</span>
            LinkedIn Scraper Active
        </div>
        <style>
            @keyframes slideIn {
                from { transform: translateX(100%); opacity: 0; }
                to { transform: translateX(0); opacity: 1; }
            }
        </style>
    `;
    document.body.appendChild(indicator);
    
    // Remove after 4 seconds
    setTimeout(() => {
        const el = document.getElementById('linkedin-scraper-indicator');
        if (el) {
            el.style.animation = 'slideIn 0.5s ease-out reverse';
            setTimeout(() => el.remove(), 500);
        }
    }, 4000);
}

// Initialize when page loads
function initialize() {
    // Only run on LinkedIn profile pages
    if (window.location.href.includes('linkedin.com/in/')) {
        console.log('📊 LinkedIn profile page detected:', window.location.href);
        addExtensionIndicator();
        
        // Log profile information for debugging
        setTimeout(() => {
            const nameElement = document.querySelector('h1.text-heading-xlarge');
            if (nameElement) {
                console.log('👤 Profile detected:', nameElement.textContent.trim());
            }
        }, 2000);
    }
}

// Run initialization
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initialize);
} else {
    initialize();
}

// Handle navigation in SPA (Single Page Application)
let currentUrl = window.location.href;
const urlCheckInterval = setInterval(() => {
    if (window.location.href !== currentUrl) {
        currentUrl = window.location.href;
        console.log('🔄 URL changed to:', currentUrl);
        setTimeout(initialize, 1000); // Delay to allow page to load
    }
}, 1000);

// Clean up interval when page unloads
window.addEventListener('beforeunload', () => {
    clearInterval(urlCheckInterval);
});

// Listen for messages from popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'extractProfile') {
        console.log('📨 Received extraction request from popup');
        
        // Use the same extraction function as in popup.js
        try {
            const profileData = extractLinkedInProfile();
            sendResponse({ success: true, data: profileData });
        } catch (error) {
            console.error('❌ Content script extraction failed:', error);
            sendResponse({ success: false, error: error.message });
        }
    }
    
    return true; // Keep message channel open for async response
});

console.log('✅ LinkedIn Profile Scraper content script ready');