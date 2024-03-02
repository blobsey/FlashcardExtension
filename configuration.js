document.addEventListener('DOMContentLoaded', async () => {
    const form = document.getElementById('config-form');
    try {
      // Load the current configuration
      const config = await browser.storage.local.get('config');
      if (config && config.config) {
        document.getElementById('apiBaseUrl').value = config.config.apiBaseUrl || '';
        document.getElementById('apiKey').value = config.config.apiKey || '';
      }
  
      // Save configuration on form submit
      form.addEventListener('submit', async (e) => {
        e.preventDefault();
        await browser.storage.local.set({
          config: {
            apiBaseUrl: document.getElementById('apiBaseUrl').value,
            apiKey: document.getElementById('apiKey').value
          }
        });
        // Provide feedback or close the popup
        alert('Configuration saved successfully!');
        window.close(); // Optionally close the popup after saving
      });
    } catch (error) {
      console.error('Failed to load or save configuration:', error);
    }
  });
  