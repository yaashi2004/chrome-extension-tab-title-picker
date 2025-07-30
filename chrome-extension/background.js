// background.js - Service Worker for LinkedIn Profile Scraper Extension
console.log('🔗 LinkedIn Profile Scraper background service worker starting...');

// Configuration
const CONFIG = {
    API_BASE_URL: 'http://localhost:3000/api',
    LINKEDIN_DOMAINS: ['linkedin.com', 'www.linkedin.com'],
    TAB_TIMEOUT: 45000, // Increased to 45 seconds
    PROCESSING_DELAY: 3000, // Increased to 3 seconds between profiles
    MAX_CONCURRENT_TABS: 1, // Reduced to 1 for stability
    MAX_RETRIES: 2
};

// State management
let extensionState = {
    isProcessing: false,
    currentBatch: [],
    processedCount: 0,
    successCount: 0,
    errorCount: 0,
    activeTabs: new Set(),
    processingStartTime: null
};

// ====================
// EXTENSION LIFECYCLE
// ====================

chrome.runtime.onInstalled.addListener((details) => {
    console.log('🚀 LinkedIn Profile Scraper installed/updated');
    
    if (details.reason === 'install') {
        console.log('✨ Welcome to LinkedIn Profile Scraper!');
        
        chrome.storage.local.set({
            linkedinUrls: [],
            settings: {
                processingDelay: CONFIG.PROCESSING_DELAY,
                maxConcurrentTabs: CONFIG.MAX_CONCURRENT_TABS,
                autoCloseSuccessfulTabs: true,
                showNotifications: true
            },
            statistics: {
                totalProcessed: 0,
                totalSuccess: 0,
                totalErrors: 0,
                lastProcessed: null
            }
        });
    }
});

chrome.runtime.onStartup.addListener(() => {
    console.log('🔄 LinkedIn Profile Scraper service worker restarted');
    resetState();
});

// ====================
// MESSAGE HANDLING
// ====================

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    console.log('📨 Background received message:', message.action);
    
    switch (message.action) {
        case 'startBatchProcessing':
            handleStartBatchProcessing(message.data, sendResponse);
            return true;
            
        case 'stopBatchProcessing':
            handleStopBatchProcessing(sendResponse);
            return true;
            
        case 'getProcessingStatus':
            handleGetProcessingStatus(sendResponse);
            return true;
            
        case 'testApiConnection':
            handleTestApiConnection(sendResponse);
            return true;
            
        case 'getStatistics':
            handleGetStatistics(sendResponse);
            return true;
            
        case 'resetStatistics':
            handleResetStatistics(sendResponse);
            return true;
            
        default:
            console.warn('⚠️ Unknown message action:', message.action);
            sendResponse({ success: false, error: 'Unknown action' });
    }
});

// ====================
// BATCH PROCESSING LOGIC
// ====================

async function handleStartBatchProcessing(data, sendResponse) {
    try {
        if (extensionState.isProcessing) {
            sendResponse({ 
                success: false, 
                error: 'Batch processing already in progress' 
            });
            return;
        }
        
        const { urls } = data;
        
        if (!urls || !Array.isArray(urls) || urls.length === 0) {
            sendResponse({ 
                success: false, 
                error: 'No URLs provided for processing' 
            });
            return;
        }
        
        console.log('🚀 Starting batch processing of', urls.length, 'URLs');
        
        // Initialize processing state
        extensionState.isProcessing = true;
        extensionState.currentBatch = [...urls];
        extensionState.processedCount = 0;
        extensionState.successCount = 0;
        extensionState.errorCount = 0;
        extensionState.processingStartTime = Date.now(); // Use timestamp instead of Date object
        
        // Start processing
        const results = await processBatchUrls(urls);
        
        // Update statistics
        await updateStatistics(results);
        
        // Reset state
        resetState();
        
        console.log('✅ Batch processing completed:', results.summary);
        
        sendResponse({
            success: true,
            data: {
                results,
                summary: results.summary,
                processingTime: Date.now() - extensionState.processingStartTime
            }
        });
        
        showNotification('success', 
            `Batch completed! ${results.summary.success}/${results.summary.total} profiles processed successfully`
        );
        
    } catch (error) {
        console.error('❌ Batch processing failed:', error);
        resetState();
        
        sendResponse({
            success: false,
            error: error.message
        });
        
        showNotification('error', 'Batch processing failed: ' + error.message);
    }
}

async function processBatchUrls(urls) {
    const results = {
        successful: [],
        failed: [],
        skipped: [],
        summary: {
            total: urls.length,
            success: 0,
            errors: 0,
            duplicates: 0,
            startTime: Date.now(),
            endTime: null
        }
    };
    
    console.log('📊 Processing', urls.length, 'URLs in batch mode');
    
    for (let i = 0; i < urls.length; i++) {
        const url = urls[i];
        
        try {
            console.log(`🔄 Processing ${i + 1}/${urls.length}: ${url}`);
            
            extensionState.processedCount = i + 1;
            notifyPopupProgress(i + 1, urls.length, url);
            
            const result = await processSingleUrl(url);
            
            if (result.success) {
                results.successful.push({
                    url,
                    profile: result.profile,
                    profileId: result.profileId
                });
                results.summary.success++;
                extensionState.successCount++;
                
                console.log('✅ Successfully processed:', result.profile?.name || 'Unknown');
            } else if (result.isDuplicate) {
                results.skipped.push({
                    url,
                    reason: 'duplicate',
                    error: result.error
                });
                results.summary.duplicates++;
                
                console.log('ℹ️ Skipped duplicate:', url);
            } else {
                results.failed.push({
                    url,
                    error: result.error
                });
                results.summary.errors++;
                extensionState.errorCount++;
                
                console.error('❌ Failed to process:', url, result.error);
            }
            
        } catch (error) {
            console.error('❌ Error processing URL:', url, error);
            
            results.failed.push({
                url,
                error: error.message
            });
            results.summary.errors++;
            extensionState.errorCount++;
        }
        
        // Add delay between requests
        if (i < urls.length - 1) {
            await wait(CONFIG.PROCESSING_DELAY);
        }
        
        // Check if processing was stopped
        if (!extensionState.isProcessing) {
            console.log('⏹️ Batch processing stopped by user');
            break;
        }
    }
    
    results.summary.endTime = Date.now();
    results.summary.processingTime = results.summary.endTime - results.summary.startTime;
    
    return results;
}

async function processSingleUrl(url) {
    let tab = null;
    let retryCount = 0;
    
    while (retryCount < CONFIG.MAX_RETRIES) {
        try {
            console.log(`📂 Attempt ${retryCount + 1}/${CONFIG.MAX_RETRIES} for URL: ${url}`);
            
            // Create new tab
            tab = await chrome.tabs.create({
                url: url,
                active: false
            });
            
            console.log('📂 Opened tab:', tab.id);
            extensionState.activeTabs.add(tab.id);
            
            // Wait for page to load with timeout
            await waitForTabComplete(tab.id, CONFIG.TAB_TIMEOUT);
            
            // Additional wait for dynamic content
            await wait(5000);
            
            // Extract profile data
            const profileData = await extractProfileFromTab(tab.id);
            
            if (!profileData || !profileData.name) {
                throw new Error('Failed to extract profile data - no name found');
            }
            
            profileData.url = url;
            
            // Send to backend API
            const saveResult = await saveProfileToBackend(profileData);
            
            if (!saveResult.success) {
                const isDuplicate = saveResult.error && saveResult.error.includes('already exists');
                
                // Close tab before returning
                await closeTab(tab.id);
                
                return {
                    success: false,
                    isDuplicate: isDuplicate,
                    error: saveResult.error
                };
            }
            
            // Close tab
            await closeTab(tab.id);
            
            return {
                success: true,
                profile: profileData,
                profileId: saveResult.profileId
            };
            
        } catch (error) {
            console.error(`❌ Attempt ${retryCount + 1} failed for URL: ${url}`, error.message);
            
            // Clean up tab
            if (tab && extensionState.activeTabs.has(tab.id)) {
                await closeTab(tab.id);
            }
            
            retryCount++;
            
            if (retryCount < CONFIG.MAX_RETRIES) {
                console.log(`🔄 Retrying in 2 seconds...`);
                await wait(2000);
            }
        }
    }
    
    return {
        success: false,
        error: `Failed after ${CONFIG.MAX_RETRIES} attempts`
    };
}

async function closeTab(tabId) {
    try {
        await chrome.tabs.remove(tabId);
        extensionState.activeTabs.delete(tabId);
        console.log('🔒 Tab closed:', tabId);
    } catch (error) {
        console.warn('Warning: Could not close tab:', tabId, error.message);
        extensionState.activeTabs.delete(tabId);
    }
}

// ====================
// PROFILE EXTRACTION
// ====================

async function extractProfileFromTab(tabId) {
    try {
        console.log('🔍 Extracting profile from tab:', tabId);
        
        // First try to inject content script
        try {
            await chrome.scripting.executeScript({
                target: { tabId: tabId },
                files: ['content.js']
            });
        } catch (injectError) {
            console.log('Content script already injected or injection failed:', injectError.message);
        }
        
        // Wait a bit more for the script to load
        await wait(2000);
        
        // Execute extraction
        const results = await chrome.scripting.executeScript({
            target: { tabId: tabId },
            function: extractLinkedInProfileAdvanced
        });
        
        if (results && results[0] && results[0].result) {
            return results[0].result;
        }
        
        throw new Error('No data returned from extraction script');
        
    } catch (error) {
        console.error('❌ Profile extraction failed for tab:', tabId, error);
        throw error;
    }
}

// Fixed LinkedIn Profile Extraction - Accurate Follower/Connection Counts
function extractLinkedInProfileAdvanced() {
    try {
        console.log('🔍 Advanced LinkedIn profile extraction starting...');
        
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
            profilePicture: '',
            experience: [],
            education: [],
            skills: [],
            extractionStatus: 'success',
            extractedAt: new Date().toISOString()
        };

        // Extract name
        const nameSelectors = [
            'h1.text-heading-xlarge.inline.t-24.v-align-middle.break-words',
            'h1.text-heading-xlarge',
            '.pv-text-details__left-panel h1',
            '.ph5 h1',
            'h1[aria-label]'
        ];
        
        for (const selector of nameSelectors) {
            const element = document.querySelector(selector);
            if (element && element.textContent.trim()) {
                profileData.name = element.textContent.trim();
                console.log('✅ Name extracted:', profileData.name);
                break;
            }
        }

        // Extract headline
        const headlineSelectors = [
            '.text-body-medium.break-words',
            '.pv-text-details__left-panel .text-body-medium',
            '.ph5 .text-body-medium'
        ];
        
        for (const selector of headlineSelectors) {
            const element = document.querySelector(selector);
            if (element && element.textContent.trim() && !element.textContent.includes('•')) {
                const text = element.textContent.trim();
                profileData.bioLine = text;
                profileData.headline = text;
                profileData.bio = text;
                console.log('✅ Headline extracted:', profileData.bioLine);
                break;
            }
        }

        // Extract location
        const locationSelectors = [
            '.text-body-small.inline.t-black--light.break-words',
            '.pv-text-details__left-panel .text-body-small'
        ];
        
        const locationKeywords = ['connection', 'follower', 'view', 'profile', 'contact', 'mutual'];
        
        for (const selector of locationSelectors) {
            const elements = document.querySelectorAll(selector);
            for (const element of elements) {
                const text = element.textContent.trim();
                const isLocation = text && 
                    !text.includes('•') && 
                    !text.match(/\d+/) && 
                    text.length > 2 && 
                    text.length < 100 &&
                    !locationKeywords.some(keyword => text.toLowerCase().includes(keyword));
                
                if (isLocation) {
                    profileData.location = text;
                    console.log('✅ Location extracted:', profileData.location);
                    break;
                }
            }
            if (profileData.location) break;
        }

        // FIXED: Extract follower and connection counts with specific selectors
        console.log('🔍 Starting count extraction...');
        
        // Method 1: Try specific LinkedIn connection/follower elements
        const connectionSelectors = [
            // New LinkedIn layout
            'a[href*="/search/results/people/?network=%5B%22F%22%5D"] .t-black--light .t-bold',
            'a[href*="search/results/people"] .t-black--light',
            '.pv-top-card--list-bullet li:first-child .t-black--light',
            
            // Alternative selectors
            '.pv-top-card__connections .t-black--light',
            '.pv-top-card--list .pv-top-card--list-bullet li .t-black--light'
        ];
        
        const followerSelectors = [
            // New LinkedIn layout  
            'a[href*="/followers/"] .t-black--light .t-bold',
            'a[href*="followers"] .t-black--light',
            '.pv-top-card--list-bullet li:last-child .t-black--light',
            
            // Alternative selectors
            '.pv-top-card__followers .t-black--light'
        ];

        // Extract connection count
        for (const selector of connectionSelectors) {
            try {
                const element = document.querySelector(selector);
                if (element) {
                    const text = element.textContent.trim();
                    console.log('🔍 Found connection element text:', text);
                    
                    if (text.toLowerCase().includes('connection')) {
                        const match = text.match(/(\d+(?:,\d+)*)/);
                        if (match) {
                            profileData.connectionCount = parseInt(match[1].replace(/,/g, ''));
                            console.log('✅ Connection count extracted:', profileData.connectionCount);
                            break;
                        }
                    }
                }
            } catch (e) {
                console.warn('Error with connection selector:', selector, e.message);
            }
        }

        // Extract follower count
        for (const selector of followerSelectors) {
            try {
                const element = document.querySelector(selector);
                if (element) {
                    const text = element.textContent.trim();
                    console.log('🔍 Found follower element text:', text);
                    
                    if (text.toLowerCase().includes('follower')) {
                        const match = text.match(/(\d+(?:,\d+)*)/);
                        if (match) {
                            profileData.followerCount = parseInt(match[1].replace(/,/g, ''));
                            console.log('✅ Follower count extracted:', profileData.followerCount);
                            break;
                        }
                    }
                }
            } catch (e) {
                console.warn('Error with follower selector:', selector, e.message);
            }
        }

        // Method 2: Fallback - scan all elements but with better filtering
        if (profileData.connectionCount === 0 && profileData.followerCount === 0) {
            console.log('🔍 Using fallback method for counts...');
            
            const allElements = document.querySelectorAll('.t-black--light, .t-normal, .pv-top-card--list-bullet li');
            
            for (const element of allElements) {
                const text = element.textContent.trim().toLowerCase();
                
                // Only process elements that are clearly about connections/followers
                if (text.includes('connection') && !text.includes('mutual') && !text.includes('view')) {
                    // Look for pattern like "500+ connections" or "1,234 connections"
                    const connectionMatch = text.match(/(\d+(?:,\d+)*)\+?\s*connection/i);
                    if (connectionMatch && profileData.connectionCount === 0) {
                        profileData.connectionCount = parseInt(connectionMatch[1].replace(/,/g, ''));
                        console.log('✅ Connection count (fallback):', profileData.connectionCount);
                    }
                }
                
                if (text.includes('follower') && !text.includes('following')) {
                    // Look for pattern like "1,500 followers" 
                    const followerMatch = text.match(/(\d+(?:,\d+)*)\+?\s*follower/i);
                    if (followerMatch && profileData.followerCount === 0) {
                        profileData.followerCount = parseInt(followerMatch[1].replace(/,/g, ''));
                        console.log('✅ Follower count (fallback):', profileData.followerCount);
                    }
                }
            }
        }

        // Method 3: Super specific method - look for clickable connection/follower links
        if (profileData.connectionCount === 0) {
            const connectionLinks = document.querySelectorAll('a[href*="search/results/people"], a[href*="network"]');
            for (const link of connectionLinks) {
                const text = link.textContent.trim().toLowerCase();
                if (text.includes('connection')) {
                    const match = text.match(/(\d+(?:,\d+)*)/);
                    if (match) {
                        const count = parseInt(match[1].replace(/,/g, ''));
                        // Sanity check - most LinkedIn users have < 100K connections
                        if (count < 100000) {
                            profileData.connectionCount = count;
                            console.log('✅ Connection count (link method):', profileData.connectionCount);
                            break;
                        }
                    }
                }
            }
        }

        if (profileData.followerCount === 0) {
            const followerLinks = document.querySelectorAll('a[href*="followers"]');
            for (const link of followerLinks) {
                const text = link.textContent.trim().toLowerCase();
                if (text.includes('follower')) {
                    const match = text.match(/(\d+(?:,\d+)*)/);
                    if (match) {
                        const count = parseInt(match[1].replace(/,/g, ''));
                        // More flexible limit for followers (some people do have millions)
                        if (count < 10000000) { // 10M limit
                            profileData.followerCount = count;
                            console.log('✅ Follower count (link method):', profileData.followerCount);
                            break;
                        }
                    }
                }
            }
        }

        // Sanity check and validation
        if (profileData.connectionCount > 100000) {
            console.warn('⚠️ Connection count seems too high, setting to 0:', profileData.connectionCount);
            profileData.connectionCount = 0;
        }
        
        if (profileData.followerCount > 50000000) { // 50M seems like a reasonable upper limit
            console.warn('⚠️ Follower count seems too high, setting to 0:', profileData.followerCount);
            profileData.followerCount = 0;
        }

        // Extract profile picture
        const profileImgSelectors = [
            '.pv-top-card__photo img',
            '.profile-photo-edit__preview img',
            '.pv-top-card-profile-picture img'
        ];
        
        for (const selector of profileImgSelectors) {
            const img = document.querySelector(selector);
            if (img && img.src && !img.src.includes('data:') && img.src.includes('http')) {
                profileData.profilePicture = img.src;
                console.log('✅ Profile picture extracted');
                break;
            }
        }

        // Extract about section
        const aboutSelectors = [
            '#about ~ * .inline-show-more-text',
            '.pv-about-section .pv-shared-text-with-see-more',
            '.pv-about__summary-text .inline-show-more-text'
        ];
        
        for (const selector of aboutSelectors) {
            const element = document.querySelector(selector);
            if (element && element.textContent.trim().length > profileData.bioLine.length) {
                profileData.about = element.textContent.trim();
                console.log('✅ About section extracted:', profileData.about.substring(0, 50) + '...');
                break;
            }
        }

        // Extract experience (improved)
        const experienceElements = document.querySelectorAll('#experience ~ * .pvs-list__item, [data-section="experience"] .pvs-list__item');
        
        if (experienceElements.length > 0) {
            const experience = [];
            experienceElements.forEach((elem, index) => {
                if (index < 5) { // Limit to first 5 experiences
                    const titleSelectors = ['.t-bold', '.mr1.t-bold', '.pvs-entity__caption-wrapper .t-bold'];
                    const companySelectors = ['.t-14.t-normal', '.pvs-entity__caption-wrapper .t-14'];
                    
                    let title = '';
                    let company = '';
                    
                    for (const selector of titleSelectors) {
                        const titleElem = elem.querySelector(selector);
                        if (titleElem) {
                            title = titleElem.textContent.trim();
                            break;
                        }
                    }
                    
                    for (const selector of companySelectors) {
                        const companyElem = elem.querySelector(selector);
                        if (companyElem && !companyElem.textContent.includes(title)) {
                            company = companyElem.textContent.trim();
                            break;
                        }
                    }
                    
                    if (title || company) {
                        experience.push({
                            title: title,
                            company: company,
                            order: index
                        });
                    }
                }
            });
            profileData.experience = experience;
            console.log('✅ Experience extracted:', experience.length, 'entries');
        }

        // Extract skills
        const skillElements = document.querySelectorAll('#skills ~ * .pvs-list__item .t-bold, [data-section="skills"] .t-bold');
        
        if (skillElements.length > 0) {
            const skills = [];
            skillElements.forEach((elem, index) => {
                if (index < 15) { // Limit to first 15 skills
                    const skillText = elem.textContent.trim();
                    if (skillText && skillText.length < 50 && skillText.length > 1) {
                        skills.push(skillText);
                    }
                }
            });
            profileData.skills = [...new Set(skills)]; // Remove duplicates
            console.log('✅ Skills extracted:', profileData.skills.length, 'skills');
        }

        // Determine extraction status
        if (!profileData.name) {
            profileData.extractionStatus = 'failed';
        } else if (!profileData.bioLine && !profileData.location) {
            profileData.extractionStatus = 'partial';
        }

        console.log('✅ Advanced profile extraction complete:', {
            name: profileData.name,
            hasLocation: !!profileData.location,
            hasBio: !!profileData.bioLine,
            hasAbout: !!profileData.about,
            followerCount: profileData.followerCount,
            connectionCount: profileData.connectionCount,
            experienceCount: profileData.experience.length,
            skillsCount: profileData.skills.length,
            status: profileData.extractionStatus
        });

        return profileData;
        
    } catch (error) {
        console.error('❌ Advanced profile extraction failed:', error);
        return {
            name: 'Extraction Failed',
            bioLine: 'Could not extract profile data',
            extractionStatus: 'failed',
            extractionError: error.message,
            extractedAt: new Date().toISOString()
        };
    }
}
// ====================
// API COMMUNICATION
// ====================

async function saveProfileToBackend(profileData) {
    try {
        console.log('💾 Saving profile to backend:', profileData.name);
        
        const response = await fetch(`${CONFIG.API_BASE_URL}/profiles`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(profileData)
        });
        
        const result = await response.json();
        
        if (response.ok && result.success) {
            return {
                success: true,
                profileId: result.data.profile.id,
                profile: result.data.profile
            };
        } else {
            return {
                success: false,
                error: result.message || `HTTP ${response.status}`
            };
        }
        
    } catch (error) {
        console.error('❌ Failed to save profile to backend:', error);
        return {
            success: false,
            error: error.message
        };
    }
}

async function handleTestApiConnection(sendResponse) {
    try {
        const response = await fetch(`${CONFIG.API_BASE_URL}/health`);
        const result = await response.json();
        
        if (response.ok) {
            sendResponse({
                success: true,
                data: {
                    status: 'online',
                    serverInfo: result
                }
            });
        } else {
            throw new Error(`API returned ${response.status}`);
        }
        
    } catch (error) {
        sendResponse({
            success: false,
            error: error.message,
            data: {
                status: 'offline'
            }
        });
    }
}

// ====================
// STATE MANAGEMENT
// ====================

function handleStopBatchProcessing(sendResponse) {
    console.log('⏹️ Stopping batch processing...');
    
    extensionState.isProcessing = false;
    
    // Close any active tabs
    extensionState.activeTabs.forEach(async (tabId) => {
        await closeTab(tabId);
    });
    
    resetState();
    
    sendResponse({
        success: true,
        message: 'Batch processing stopped'
    });
    
    showNotification('info', 'Batch processing stopped by user');
}

function handleGetProcessingStatus(sendResponse) {
    sendResponse({
        success: true,
        data: {
            isProcessing: extensionState.isProcessing,
            processedCount: extensionState.processedCount,
            successCount: extensionState.successCount,
            errorCount: extensionState.errorCount,
            totalUrls: extensionState.currentBatch.length,
            activeTabs: extensionState.activeTabs.size,
            startTime: extensionState.processingStartTime
        }
    });
}

function resetState() {
    extensionState.isProcessing = false;
    extensionState.currentBatch = [];
    extensionState.processedCount = 0;
    extensionState.successCount = 0;
    extensionState.errorCount = 0;
    extensionState.activeTabs.clear();
    extensionState.processingStartTime = null;
}

// ====================
// STATISTICS
// ====================

async function updateStatistics(results) {
    try {
        const storage = await chrome.storage.local.get(['statistics']);
        const stats = storage.statistics || {
            totalProcessed: 0,
            totalSuccess: 0,
            totalErrors: 0,
            totalDuplicates: 0,
            lastProcessed: null
        };
        
        stats.totalProcessed += results.summary.total;
        stats.totalSuccess += results.summary.success;
        stats.totalErrors += results.summary.errors;
        stats.totalDuplicates += results.summary.duplicates || 0;
        stats.lastProcessed = new Date().toISOString();
        
        await chrome.storage.local.set({ statistics: stats });
        
        console.log('📊 Statistics updated:', stats);
        
    } catch (error) {
        console.error('❌ Failed to update statistics:', error);
    }
}

async function handleGetStatistics(sendResponse) {
    try {
        const storage = await chrome.storage.local.get(['statistics']);
        const stats = storage.statistics || {
            totalProcessed: 0,
            totalSuccess: 0,
            totalErrors: 0,
            totalDuplicates: 0,
            lastProcessed: null
        };
        
        sendResponse({
            success: true,
            data: stats
        });
        
    } catch (error) {
        sendResponse({
            success: false,
            error: error.message
        });
    }
}

async function handleResetStatistics(sendResponse) {
    try {
        const resetStats = {
            totalProcessed: 0,
            totalSuccess: 0,
            totalErrors: 0,
            totalDuplicates: 0,
            lastProcessed: null
        };
        
        await chrome.storage.local.set({ statistics: resetStats });
        
        sendResponse({
            success: true,
            data: resetStats
        });
        
        console.log('🔄 Statistics reset');
        
    } catch (error) {
        sendResponse({
            success: false,
            error: error.message
        });
    }
}

// ====================
// UTILITY FUNCTIONS
// ====================

function wait(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function waitForTabComplete(tabId, timeout = CONFIG.TAB_TIMEOUT) {
    return new Promise((resolve, reject) => {
        const timeoutId = setTimeout(() => {
            reject(new Error('Tab loading timeout'));
        }, timeout);
        
        let checkCount = 0;
        const maxChecks = timeout / 500;
        
        function checkTabStatus() {
            checkCount++;
            
            chrome.tabs.get(tabId, (tab) => {
                if (chrome.runtime.lastError) {
                    clearTimeout(timeoutId);
                    reject(new Error('Tab not found: ' + chrome.runtime.lastError.message));
                    return;
                }
                
                if (tab.status === 'complete') {
                    clearTimeout(timeoutId);
                    resolve(tab);
                } else if (checkCount >= maxChecks) {
                    clearTimeout(timeoutId);
                    reject(new Error('Tab loading timeout - max checks reached'));
                } else {
                    setTimeout(checkTabStatus, 500);
                }
            });
        }
        
        checkTabStatus();
    });
}

function notifyPopupProgress(processed, total, currentUrl) {
    try {
        chrome.runtime.sendMessage({
            action: 'progressUpdate',
            data: {
                processed,
                total,
                currentUrl,
                progress: Math.round((processed / total) * 100)
            }
        }).catch(() => {
            // Popup might not be open, ignore error
        });
    } catch (error) {
        // Ignore messaging errors when popup is closed
    }
}

function showNotification(type, message) {
    try {
        chrome.storage.local.get(['settings'], (result) => {
            const settings = result.settings || {};
            
            if (settings.showNotifications !== false) {
                chrome.notifications.create({
                    type: 'basic',
                    iconUrl: 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDgiIGhlaWdodD0iNDgiIHZpZXdCb3g9IjAgMCA0OCA0OCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPHJlY3Qgd2lkdGg9IjQ4IiBoZWlnaHQ9IjQ4IiByeD0iOCIgZmlsbD0iIzAwNzdiNSIvPgo8dGV4dCB4PSIyNCIgeT0iMzIiIGZvbnQtZmFtaWx5PSJBcmlhbCIgZm9udC1zaXplPSIyMCIgZm9udC13ZWlnaHQ9ImJvbGQiIGZpbGw9IndoaXRlIiB0ZXh0LWFuY2hvcj0ibWlkZGxlIj5MSTwvdGV4dD4KICA8L3N2Zz4=',
                    title: 'LinkedIn Profile Scraper',
                    message: message
                });
            }
        });
    } catch (error) {
        console.warn('Could not show notification:', error);
    }
}

// ====================
// TAB MANAGEMENT
// ====================

chrome.tabs.onRemoved.addListener((tabId) => {
    if (extensionState.activeTabs.has(tabId)) {
        extensionState.activeTabs.delete(tabId);
        console.log('🗑️ Cleaned up closed tab:', tabId);
    }
});

chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
    if (changeInfo.status === 'complete' && 
        tab.url && 
        tab.url.includes('linkedin.com/in/')) {
        
        console.log('🔗 LinkedIn profile page loaded:', tab.url);
    }
});

// ====================
// ERROR HANDLING
// ====================

self.addEventListener('error', (event) => {
    console.error('💥 Background script error:', event.error);
});

self.addEventListener('unhandledrejection', (event) => {
    console.error('💥 Unhandled promise rejection:', event.reason);
});

console.log('✅ LinkedIn Profile Scraper background service worker ready');
console.log('🔧 Configuration:', CONFIG);