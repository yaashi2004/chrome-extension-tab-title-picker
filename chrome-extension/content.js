// content.js - Runs on LinkedIn profile pages
(function() {
    'use strict';
    
    // Prevent multiple script execution
    if (window.linkedinScraperLoaded) {
        console.log('🔗 LinkedIn Scraper already loaded, skipping...');
        return;
    }
    window.linkedinScraperLoaded = true;
    
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
                animation: slideInScraper 0.5s ease-out;
            ">
                <span style="margin-right: 8px;">🔗</span>
                LinkedIn Scraper Active
            </div>
            <style>
                @keyframes slideInScraper {
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
                el.style.animation = 'slideInScraper 0.5s ease-out reverse';
                setTimeout(() => el.remove(), 500);
            }
        }, 4000);
    }

    // LinkedIn Profile Extraction Function
    function extractLinkedInProfile() {
        try {
            console.log('🔍 Starting LinkedIn profile extraction...');
            
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
                extractionStatus: 'success'
            };

            // Extract name with multiple selectors
            const nameSelectors = [
                'h1.text-heading-xlarge.inline.t-24.v-align-middle.break-words',
                'h1.text-heading-xlarge',
                '.pv-text-details__left-panel h1',
                '.ph5 h1',
                '[data-generated-suggestion-target] h1',
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

            // Extract headline/bio line
            const headlineSelectors = [
                '.text-body-medium.break-words',
                '.pv-text-details__left-panel .text-body-medium',
                '.ph5 .text-body-medium',
                '[data-generated-suggestion-target] .text-body-medium',
                '.pv-text-details__left-panel .text-body-medium.break-words'
            ];
            
            for (const selector of headlineSelectors) {
                const element = document.querySelector(selector);
                if (element && element.textContent.trim() && !element.textContent.includes('•')) {
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
                '.pv-text-details__left-panel .text-body-small',
                '.text-body-small:not([aria-hidden])'
            ];
            
            for (const selector of locationSelectors) {
                const elements = document.querySelectorAll(selector);
                for (const element of elements) {
                    const text = element.textContent.trim();
                    // Location usually doesn't contain numbers or bullet points
                    if (text && !text.includes('•') && !text.match(/\d+/) && text.length > 2 && text.length < 100 && !text.includes('connection')) {
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
                '[data-generated-suggestion-target] .inline-show-more-text',
                '.pv-about__summary-text .inline-show-more-text',
                'section[data-section="summary"] .pv-shared-text-with-see-more'
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
            const connectionElements = document.querySelectorAll('.t-black--light, .t-normal, .pvs-header__optional-link, .pv-top-card--list-bullet li');
            for (const element of connectionElements) {
                const text = element.textContent.trim().toLowerCase();
                
                if (text.includes('connection') && !text.includes('mutual')) {
                    const match = text.match(/(\d[\d,]*)/);
                    if (match) {
                        profileData.connectionCount = parseInt(match[1].replace(/,/g, ''));
                        console.log('✅ Connection count extracted:', profileData.connectionCount);
                    }
                }
                
                if (text.includes('follower')) {
                    const match = text.match(/(\d[\d,]*)/);
                    if (match) {
                        profileData.followerCount = parseInt(match[1].replace(/,/g, ''));
                        console.log('✅ Follower count extracted:', profileData.followerCount);
                    }
                }
            }

            // Extract profile picture
            const profileImgSelectors = [
                '.pv-top-card__photo img',
                '.profile-photo-edit__preview img',
                '.pv-top-card-profile-picture img'
            ];
            
            for (const selector of profileImgSelectors) {
                const img = document.querySelector(selector);
                if (img && img.src && !img.src.includes('data:')) {
                    profileData.profilePicture = img.src;
                    console.log('✅ Profile picture extracted');
                    break;
                }
            }

            // Extract experience (basic)
            const experienceElements = document.querySelectorAll('#experience ~ * .pvs-list__item, .pv-profile-section .pv-entity__summary-info');
            if (experienceElements.length > 0) {
                const experience = [];
                experienceElements.forEach((elem, index) => {
                    if (index < 5) { // Limit to first 5 experiences
                        const titleElem = elem.querySelector('.t-bold, .pv-entity__summary-info-v2 .t-16');
                        const companyElem = elem.querySelector('.t-normal, .pv-entity__secondary-title');
                        
                        if (titleElem || companyElem) {
                            experience.push({
                                title: titleElem ? titleElem.textContent.trim() : '',
                                company: companyElem ? companyElem.textContent.trim() : ''
                            });
                        }
                    }
                });
                profileData.experience = experience;
                console.log('✅ Experience extracted:', experience.length, 'entries');
            }

            // Extract skills (basic)
            const skillElements = document.querySelectorAll('#skills ~ * .pvs-list__item .t-bold, .pv-skill-category-entity__name .pv-skill-category-entity__name-text');
            if (skillElements.length > 0) {
                const skills = [];
                skillElements.forEach((elem, index) => {
                    if (index < 10) { // Limit to first 10 skills
                        const skillText = elem.textContent.trim();
                        if (skillText && skillText.length < 50) {
                            skills.push(skillText);
                        }
                    }
                });
                profileData.skills = skills;
                console.log('✅ Skills extracted:', skills.length, 'skills');
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
                connectionCount: profileData.connectionCount,
                experienceCount: profileData.experience.length,
                skillsCount: profileData.skills.length
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

    // Make function available globally
    window.extractLinkedInProfile = extractLinkedInProfile;

    // Initialize when page loads
    function initialize() {
        // Only run on LinkedIn profile pages
        if (window.location.href.includes('linkedin.com/in/')) {
            console.log('📊 LinkedIn profile page detected:', window.location.href);
            addExtensionIndicator();
            
            // Log profile information for debugging
            setTimeout(() => {
                const nameElement = document.querySelector('h1.text-heading-xlarge, h1[aria-label]');
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

    // Handle navigation in SPA (Single Page Application) - Scoped variable
    let scraperCurrentUrl = window.location.href;
    const scraperUrlCheckInterval = setInterval(() => {
        if (window.location.href !== scraperCurrentUrl) {
            scraperCurrentUrl = window.location.href;
            console.log('🔄 URL changed to:', scraperCurrentUrl);
            setTimeout(initialize, 1000); // Delay to allow page to load
        }
    }, 1000);

    // Clean up interval when page unloads
    window.addEventListener('beforeunload', () => {
        clearInterval(scraperUrlCheckInterval);
    });

    // Listen for messages from popup
    chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
        if (request.action === 'extractProfile') {
            console.log('📨 Received extraction request from popup');
            
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
})();