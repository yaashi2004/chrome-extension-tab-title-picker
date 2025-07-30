// popup.js - LinkedIn Profile Scraper Extension
document.addEventListener('DOMContentLoaded', function() {
    // DOM Elements
    const urlInput = document.getElementById('urlInput');
    const addUrlBtn = document.getElementById('addUrlBtn');
    const urlList = document.getElementById('urlList');
    const queueCounter = document.getElementById('queueCounter');
    const processBtn = document.getElementById('processBtn');
    const apiStatusText = document.getElementById('apiStatusText');
    const statusDot = document.getElementById('statusDot');
    const testApiBtn = document.getElementById('testApiBtn');
    const statusContainer = document.getElementById('statusContainer');

    // Configuration
    const API_BASE_URL = 'http://localhost:3000/api';
    const MIN_URLS_REQUIRED = 3;
    
    // State
    let linkedinUrls = [];
    let isProcessing = false;

    // Initialize
    init();

    async function init() {
        console.log('🔄 Initializing LinkedIn Profile Scraper...');
        await checkAPIStatus();
        await loadStoredUrls();
        updateUI();
        setupEventDelegation(); // NEW: Set up event delegation
        console.log('✅ Initialization complete');
    }

    // NEW FUNCTION: Set up event delegation for dynamically created elements
    function setupEventDelegation() {
        // Use event delegation on the parent container
        urlList.addEventListener('click', function(e) {
            if (e.target.classList.contains('remove-btn')) {
                const index = parseInt(e.target.getAttribute('data-index'));
                removeUrl(index);
            }
        });
    }

    // ====================
    // URL MANAGEMENT
    // ====================

    // Add URL to queue
    addUrlBtn.addEventListener('click', addUrl);
    urlInput.addEventListener('keypress', function(e) {
        if (e.key === 'Enter') addUrl();
    });

    function addUrl() {
        const url = urlInput.value.trim();
        
        // Validation
        if (!url) {
            showStatus('warning', '⚠️ Please enter a LinkedIn URL');
            return;
        }

        if (!isValidLinkedInUrl(url)) {
            showStatus('error', '❌ Please enter a valid LinkedIn profile URL (linkedin.com/in/username)');
            return;
        }

        if (linkedinUrls.includes(url)) {
            showStatus('warning', '⚠️ This URL is already in the queue');
            return;
        }

        // Add URL
        linkedinUrls.push(url);
        urlInput.value = '';
        saveUrls();
        updateUI();
        showStatus('success', `✅ URL added! (${linkedinUrls.length} total)`);
        
        console.log('📝 URL added:', url);
    }

    // UPDATED: Remove URL from queue - no longer attached to window
    function removeUrl(index) {
        const removedUrl = linkedinUrls[index];
        linkedinUrls.splice(index, 1);
        saveUrls();
        updateUI();
        showStatus('info', 'ℹ️ URL removed from queue');
        console.log('🗑️ URL removed:', removedUrl);
    }





    // ====================
    // BATCH PROCESSING (Uses Background Script)
    // ====================

    processBtn.addEventListener('click', async function() {
        if (linkedinUrls.length < MIN_URLS_REQUIRED) {
            showStatus('warning', `⚠️ Please add at least ${MIN_URLS_REQUIRED} LinkedIn URLs`);
            return;
        }

        if (isProcessing) {
            // Stop processing
            await stopBatchProcessing();
        } else {
            // Start processing
            await startBatchProcessing();
        }
    });

    async function startBatchProcessing() {
        console.log('🚀 Starting batch processing via background script');
        
        try {
            isProcessing = true;
            updateUI();
            
            showStatus('info', '🔄 Starting batch processing...');
            
            // Send message to background script to start processing
            const response = await chrome.runtime.sendMessage({
                action: 'startBatchProcessing',
                data: {
                    urls: linkedinUrls
                }
            });
            
            if (response.success) {
                console.log('✅ Batch processing completed:', response.data.summary);
                
                const { summary } = response.data;
                showStatus('success', 
                    `🎉 Batch complete! ${summary.success}/${summary.total} profiles processed successfully`
                );
                
                // Clear queue after successful processing
                if (summary.success > 0) {
                    linkedinUrls = [];
                    saveUrls();
                }
                
            } else {
                throw new Error(response.error);
            }
            
        } catch (error) {
            console.error('❌ Batch processing failed:', error);
            showStatus('error', '❌ Batch processing failed: ' + error.message);
        }
        
        isProcessing = false;
        updateUI();
    }

    async function stopBatchProcessing() {
        console.log('⏹️ Stopping batch processing');
        
        try {
            const response = await chrome.runtime.sendMessage({
                action: 'stopBatchProcessing'
            });
            
            if (response.success) {
                showStatus('info', 'ℹ️ Batch processing stopped');
            }
            
        } catch (error) {
            console.error('❌ Failed to stop processing:', error);
        }
        
        isProcessing = false;
        updateUI();
    }

    // ====================
    // PROGRESS MONITORING
    // ====================

    // Listen for progress updates from background script
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
        if (message.action === 'progressUpdate') {
            updateProgress(message.data);
        }
    });

    function updateProgress(progressData) {
        const { processed, total, currentUrl, progress } = progressData;
        
        processBtn.innerHTML = `
            <span class="loading"></span>
            Processing ${processed}/${total} (${progress}%)
        `;
        
        showStatus('info', `🔄 Processing: ${getShortUrl(currentUrl)} (${processed}/${total})`);
    }

    async function loadProcessingStatus() {
        try {
            const response = await chrome.runtime.sendMessage({
                action: 'getProcessingStatus'
            });
            
            if (response.success) {
                const status = response.data;
                isProcessing = status.isProcessing;
                
                if (isProcessing) {
                    showStatus('info', `🔄 Processing in progress: ${status.processedCount}/${status.totalUrls}`);
                }
            }
            
        } catch (error) {
            console.warn('Could not load processing status:', error.message);
        }
    }

    // ====================
    // API MANAGEMENT
    // ====================

    testApiBtn.addEventListener('click', checkAPIStatus);

    async function checkAPIStatus() {
        try {
            console.log('🔍 Checking API status via background script...');
            apiStatusText.textContent = 'Checking...';
            statusDot.className = 'status-dot';
            
            const response = await chrome.runtime.sendMessage({
                action: 'testApiConnection'
            });
            
            if (response.success && response.data.status === 'online') {
                apiStatusText.textContent = 'Online';
                statusDot.className = 'status-dot online';
                console.log('✅ API is online');
                
                if (statusContainer.children.length === 0) {
                    showStatus('success', '✅ Backend API is online and ready');
                }
            } else {
                throw new Error(response.error || 'API offline');
            }
            
        } catch (error) {
            apiStatusText.textContent = 'Offline';
            statusDot.className = 'status-dot offline';
            showStatus('error', '❌ Backend API is offline - Please start your server (npm run dev)');
            console.error('❌ API is offline:', error.message);
        }
    }

    // ====================
    // STATISTICS
    // ====================

    async function loadStatistics() {
        try {
            const response = await chrome.runtime.sendMessage({
                action: 'getStatistics'
            });
            
            if (response.success) {
                const stats = response.data;
                console.log('📊 Extension statistics:', stats);
                
                // You can display stats in UI if needed
                if (stats.totalProcessed > 0) {
                    const successRate = Math.round((stats.totalSuccess / stats.totalProcessed) * 100);
                    console.log(`📈 Success rate: ${successRate}% (${stats.totalSuccess}/${stats.totalProcessed})`);
                }
            }
            
        } catch (error) {
            console.warn('Could not load statistics:', error.message);
        }
    }

    // ====================
    // UTILITY FUNCTIONS
    // ====================

    function isValidLinkedInUrl(url) {
        try {
            if (!url.startsWith('http://') && !url.startsWith('https://')) {
                url = 'https://' + url;
            }
            
            const urlObj = new URL(url);
            return urlObj.hostname.includes('linkedin.com') && 
                   urlObj.pathname.includes('/in/');
        } catch {
            return false;
        }
    }

    function normalizeLinkedInUrl(url) {
        try {
            if (!url.startsWith('http://') && !url.startsWith('https://')) {
                url = 'https://' + url;
            }
            
            const urlObj = new URL(url);
            let cleanPath = urlObj.pathname.replace(/\/$/, '');
            
            return `https://www.linkedin.com${cleanPath}`;
        } catch {
            return url;
        }
    }

    function getShortUrl(url) {
        try {
            const urlObj = new URL(url);
            const pathParts = urlObj.pathname.split('/');
            const username = pathParts[pathParts.length - 1] || pathParts[pathParts.length - 2];
            return `linkedin.com/in/${username}`;
        } catch {
            return url.substring(0, 30) + '...';
        }
    }

     function updateUI() {
        // Update counter
        queueCounter.textContent = linkedinUrls.length;

        // Update process button
        const canProcess = linkedinUrls.length >= MIN_URLS_REQUIRED && !isProcessing;
        processBtn.disabled = !canProcess;
        
        if (!isProcessing) {
            if (linkedinUrls.length < MIN_URLS_REQUIRED) {
                processBtn.innerHTML = `<span class="btn-icon">🚀</span>Process All Links (${MIN_URLS_REQUIRED - linkedinUrls.length} more needed)`;
            } else {
                processBtn.innerHTML = `<span class="btn-icon">🚀</span>Process All Links (${linkedinUrls.length} URLs)`;
            }
        }

        // UPDATED: Update URL list - removed inline onclick and event listener attachment
        if (linkedinUrls.length === 0) {
            urlList.innerHTML = `
                <div class="empty-state">
                    <div class="empty-icon">📋</div>
                    <div>No LinkedIn URLs added yet</div>
                    <div style="font-size: 11px; margin-top: 4px; opacity: 0.7;">Add minimum ${MIN_URLS_REQUIRED} URLs to start processing</div>
                </div>
            `;
        } else {
            urlList.innerHTML = linkedinUrls.map((url, index) => `
                <div class="url-item">
                    <div class="url-number">${index + 1}</div>
                    <div class="url-text">${getShortUrl(url)}</div>
                    <button class="remove-btn" data-index="${index}">✕</button>
                </div>
            `).join('');
        }
    }

    // ... (rest of your code remains the same) ...


    function showStatus(type, message) {
        // Remove existing status messages
        const existingStatus = statusContainer.querySelector('.status-message');
        if (existingStatus) {
            existingStatus.remove();
        }

        const statusDiv = document.createElement('div');
        statusDiv.className = `status-message ${type}`;
        statusDiv.innerHTML = `<span class="message-icon">${getStatusIcon(type)}</span>${message}`;
        statusContainer.appendChild(statusDiv);

        // Auto-remove after 5 seconds for non-error messages
        if (type !== 'error') {
            setTimeout(() => {
                if (statusDiv.parentNode) {
                    statusDiv.remove();
                }
            }, 5000);
        }

        console.log(`📢 Status [${type}]:`, message);
    }

    function getStatusIcon(type) {
        const icons = {
            success: '✅',
            error: '❌',
            warning: '⚠️',
            info: 'ℹ️'
        };
        return icons[type] || 'ℹ️';
    }

    function saveUrls() {
        chrome.storage.local.set({ linkedinUrls: linkedinUrls });
    }

    async function loadStoredUrls() {
        try {
            const result = await chrome.storage.local.get(['linkedinUrls']);
            linkedinUrls = result.linkedinUrls || [];
            console.log('📂 Loaded stored URLs:', linkedinUrls.length);
        } catch (error) {
            console.error('❌ Failed to load stored URLs:', error);
            linkedinUrls = [];
        }
    }

    // ====================
    // PERIODIC STATUS UPDATES
    // ====================

    // Check processing status every 2 seconds when popup is open
    setInterval(async () => {
        if (isProcessing) {
            await loadProcessingStatus();
        }
    }, 2000);

    // Load statistics on startup
    loadStatistics();
});