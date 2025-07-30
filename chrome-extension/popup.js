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
        console.log('✅ Initialization complete');
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

    // Remove URL from queue
    window.removeUrl = function(index) {
        const removedUrl = linkedinUrls[index];
        linkedinUrls.splice(index, 1);
        saveUrls();
        updateUI();
        showStatus('info', 'ℹ️ URL removed from queue');
        console.log('🗑️ URL removed:', removedUrl);
    };

    // ====================
    // BATCH PROCESSING (MAIN FUNCTIONALITY)
    // ====================

    processBtn.addEventListener('click', async function() {
        if (linkedinUrls.length < MIN_URLS_REQUIRED) {
            showStatus('warning', `⚠️ Please add at least ${MIN_URLS_REQUIRED} LinkedIn URLs`);
            return;
        }

        console.log('🚀 Starting batch processing of', linkedinUrls.length, 'URLs');
        
        isProcessing = true;
        updateUI();

        processBtn.innerHTML = '<span class="loading"></span>Processing URLs...';
        showStatus('info', '🔄 Starting batch processing...');

        let successCount = 0;
        let errorCount = 0;
        const results = [];

        try {
            for (let i = 0; i < linkedinUrls.length; i++) {
                const url = linkedinUrls[i];
                
                processBtn.innerHTML = `<span class="loading"></span>Processing ${i + 1}/${linkedinUrls.length}`;
                showStatus('info', `🔄 Processing: ${getShortUrl(url)}`);

                try {
                    console.log(`📊 Processing URL ${i + 1}/${linkedinUrls.length}:`, url);

                    // Step 1: Open LinkedIn profile in new tab
                    const tab = await chrome.tabs.create({ 
                        url: url, 
                        active: false 
                    });

                    console.log('📂 Tab opened:', tab.id);

                    // Step 2: Wait for page to load
                    await wait(3000);

                    // Step 3: Extract profile data
                    const results = await chrome.scripting.executeScript({
                        target: { tabId: tab.id },
                        function: extractLinkedInProfile
                    });

                    if (results[0].result) {
                        const profileData = results[0].result;
                        profileData.url = url;

                        console.log('📊 Profile data extracted:', profileData.name || 'Unknown');

                        // Step 4: Send to backend API
                        const response = await fetch(`${API_BASE_URL}/profiles`, {
                            method: 'POST',
                            headers: {
                                'Content-Type': 'application/json',
                            },
                            body: JSON.stringify(profileData)
                        });

                        const result = await response.json();

                        if (result.success) {
                            successCount++;
                            results.push({
                                url,
                                status: 'success',
                                name: profileData.name,
                                id: result.data.profile.id
                            });
                            showStatus('success', `✅ Saved: ${profileData.name || 'Profile'}`);
                            console.log('✅ Profile saved successfully:', result.data.profile.id);
                        } else {
                            errorCount++;
                            results.push({ url, status: 'error', error: result.message });
                            showStatus('error', `❌ API Error: ${result.message}`);
                            console.error('❌ API Error:', result.message);
                        }
                    } else {
                        errorCount++;
                        results.push({ url, status: 'error', error: 'Failed to extract profile data' });
                        showStatus('error', `❌ Failed to extract: ${getShortUrl(url)}`);
                        console.error('❌ Failed to extract profile data from:', url);
                    }

                    // Step 5: Close the tab
                    await chrome.tabs.remove(tab.id);
                    console.log('🔒 Tab closed:', tab.id);

                } catch (error) {
                    errorCount++;
                    results.push({ url, status: 'error', error: error.message });
                    showStatus('error', `❌ Error processing: ${getShortUrl(url)}`);
                    console.error('❌ Error processing URL:', url, error);
                }

                // Small delay between requests
                await wait(1000);
            }

            // Final results
            const totalProcessed = successCount + errorCount;
            showStatus('success', `🎉 Batch complete! Success: ${successCount}/${totalProcessed}, Errors: ${errorCount}`);
            
            console.log('🎉 Batch processing complete:', {
                total: totalProcessed,
                success: successCount,
                errors: errorCount,
                results
            });

            // Clear queue after successful processing
            if (successCount > 0) {
                linkedinUrls = [];
                saveUrls();
            }

        } catch (error) {
            showStatus('error', '❌ Batch processing failed: ' + error.message);
            console.error('❌ Batch processing failed:', error);
        }

        isProcessing = false;
        updateUI();
    });

    // ====================
    // API MANAGEMENT
    // ====================

    testApiBtn.addEventListener('click', checkAPIStatus);

    async function checkAPIStatus() {
        try {
            console.log('🔍 Checking API status...');
            apiStatusText.textContent = 'Checking...';
            statusDot.className = 'status-dot';
            
            const response = await fetch(`${API_BASE_URL}/health`, {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json'
                }
            });
            
            if (response.ok) {
                const result = await response.json();
                apiStatusText.textContent = 'Online';
                statusDot.className = 'status-dot online';
                console.log('✅ API is online:', result.phase);
                
                if (statusContainer.children.length === 0) {
                    showStatus('success', '✅ Backend API is online and ready');
                }
            } else {
                throw new Error(`HTTP ${response.status}`);
            }
        } catch (error) {
            apiStatusText.textContent = 'Offline';
            statusDot.className = 'status-dot offline';
            showStatus('error', '❌ Backend API is offline - Please start your server (npm run dev)');
            console.error('❌ API is offline:', error.message);
        }
    }

    // ====================
    // UTILITY FUNCTIONS
    // ====================

    function isValidLinkedInUrl(url) {
        try {
            // Add protocol if missing
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

        // Update URL list
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
                    <button class="remove-btn" onclick="removeUrl(${index})">✕</button>
                </div>
            `).join('');
        }
    }

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

    function wait(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
});

// ====================
// PROFILE EXTRACTION FUNCTION
// ====================

// This function gets injected into LinkedIn pages
function extractLinkedInProfile() {
    try {
        console.log('🔍 Starting LinkedIn profile extraction...');
        
        // Wait for page to be fully loaded
        if (document.readyState !== 'complete') {
            console.log('⏳ Page not fully loaded, waiting...');
            return null;
        }

        const profileData = {
            name: '',
            about: '',
            bio: '',
            location: '',
            followerCount: 0,
            connectionCount: 0,
            bioLine: '',
            headline: '',
            industry: '',
            extractionStatus: 'success'
        };

        // Extract name with multiple selectors
        const nameSelectors = [
            'h1.text-heading-xlarge.inline.t-24.v-align-middle.break-words',
            'h1.text-heading-xlarge',
            '.pv-text-details__left-panel h1',
            '.ph5 h1',
            '[data-generated-suggestion-target] h1'
        ];
        
        for (const selector of nameSelectors) {
            const element = document.querySelector(selector);
            if (element && element.textContent.trim()) {
                profileData.name = element.textContent.trim();
                console.log('✅ Name extracted:', profileData.name);
                break;
            }
        }

        // Extract headline/bio line
        const headlineSelectors = [
            '.text-body-medium.break-words',
            '.pv-text-details__left-panel .text-body-medium',
            '.ph5 .text-body-medium',
            '[data-generated-suggestion-target] .text-body-medium'
        ];
        
        for (const selector of headlineSelectors) {
            const element = document.querySelector(selector);
            if (element && element.textContent.trim()) {
                profileData.bioLine = element.textContent.trim();
                profileData.headline = element.textContent.trim();
                profileData.bio = element.textContent.trim();
                console.log('✅ Headline extracted:', profileData.bioLine);
                break;
            }
        }

        // Extract location
        const locationSelectors = [
            '.text-body-small.inline.t-black--light.break-words',
            '.pv-text-details__left-panel .text-body-small'
        ];
        
        for (const selector of locationSelectors) {
            const elements = document.querySelectorAll(selector);
            for (const element of elements) {
                const text = element.textContent.trim();
                // Location usually doesn't contain numbers or bullet points
                if (text && !text.includes('•') && !text.match(/\d+/) && text.length > 2 && text.length < 100) {
                    profileData.location = text;
                    console.log('✅ Location extracted:', profileData.location);
                    break;
                }
            }
            if (profileData.location) break;
        }

        // Extract about section
        const aboutSelectors = [
            '#about ~ * .inline-show-more-text',
            '.pv-about-section .pv-shared-text-with-see-more',
            '[data-generated-suggestion-target] .inline-show-more-text'
        ];
        
        for (const selector of aboutSelectors) {
            const element = document.querySelector(selector);
            if (element && element.textContent.trim().length > profileData.bioLine.length) {
                profileData.about = element.textContent.trim();
                console.log('✅ About section extracted:', profileData.about.substring(0, 50) + '...');
                break;
            }
        }

        // Extract follower/connection counts
        const connectionElements = document.querySelectorAll('.t-black--light, .t-normal, .pvs-header__optional-link');
        for (const element of connectionElements) {
            const text = element.textContent.trim().toLowerCase();
            
            if (text.includes('connection')) {
                const match = text.match(/(\d+)/);
                if (match) {
                    profileData.connectionCount = parseInt(match[1]);
                    console.log('✅ Connection count extracted:', profileData.connectionCount);
                }
            }
            
            if (text.includes('follower')) {
                const match = text.match(/(\d+)/);
                if (match) {
                    profileData.followerCount = parseInt(match[1]);
                    console.log('✅ Follower count extracted:', profileData.followerCount);
                }
            }
        }

        // Validate extracted data
        if (!profileData.name || !profileData.bioLine) {
            console.warn('⚠️ Incomplete profile data extracted');
            profileData.extractionStatus = 'partial';
        }

        console.log('✅ Profile extraction complete:', {
            name: profileData.name,
            hasLocation: !!profileData.location,
            hasBio: !!profileData.bioLine,
            hasAbout: !!profileData.about,
            followerCount: profileData.followerCount,
            connectionCount: profileData.connectionCount
        });

        return profileData;
        
    } catch (error) {
        console.error('❌ Profile extraction failed:', error);
        return {
            name: 'Extraction Failed',
            bioLine: 'Could not extract profile data',
            extractionStatus: 'failed',
            extractionError: error.message
        };
    }
}