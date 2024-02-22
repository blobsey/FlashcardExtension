document.addEventListener('DOMContentLoaded', function() {
    const form = document.getElementById('configForm');
    const apiBaseUrlInput = document.getElementById('apiBaseUrl');

    // Load the current API base URL from storage and populate the form
    browser.storage.local.get('API_BASE_URL').then((res) => {
        apiBaseUrlInput.value = res.API_BASE_URL;
    });

    form.addEventListener('submit', function(e) {
        e.preventDefault();
        const apiBaseUrl = apiBaseUrlInput.value.trim();
        // Save the API base URL to storage
        browser.storage.local.set({ 'API_BASE_URL': apiBaseUrl }).then(() => {
            alert('API Base URL saved successfully.');
        });
    });
});
