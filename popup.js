document.addEventListener('DOMContentLoaded', function() {
    const getTitle = document.getElementById('getTitle');
    const titleDisplay = document.getElementById('titleDisplay');

    getTitle.addEventListener('click', function() {
        // Show loading state
        titleDisplay.innerHTML = '<span class="loading">🔄 Fetching tab title...</span>';

        // Query for the active tab in the current window
        chrome.tabs.query({ active: true, currentWindow: true }, function(tabs) {
            if (tabs && tabs.length > 0) {
                const currentTab = tabs[0];
                const tabTitle = currentTab.title;

                // Hide the button
                getTitle.style.display = 'none';

                // Display the title
                titleDisplay.innerHTML = `
                    <div class="title-text">
                        <strong>📄 Current Tab Title:</strong><br><br>
                        "${tabTitle}"
                    </div>
                `;
                titleDisplay.classList.remove('loading');
            } else {
                titleDisplay.innerHTML = '<span style="color: #ffcdd2;">❌ Could not fetch tab title</span>';
            }
        });
    });
});
