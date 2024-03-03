// Dynamically generate config form
document.addEventListener('DOMContentLoaded', async () => {
    const form = document.getElementById('config-form');

    try {
        // Load the current configuration
        const {result, config }= await browser.runtime.sendMessage({ action: "getConfig" });

        // Dynamically create form inputs and labels based on config
        Object.keys(config).forEach(key => {
            const label = document.createElement('label');
            label.textContent = key.charAt(0).toUpperCase() + key.slice(1); // Capitalize the first letter
            label.htmlFor = key;
            form.appendChild(label);

            const input = document.createElement('input');
            input.id = key;
            input.value = config[key] || '';
            input.name = key;
            
            // Apply specific input types or classes based on the key if necessary
            // For example, setting type to "password" for apiKey
            if (key === 'apiKey') {
                input.type = 'password';
            } else {
                input.type = 'text';
            }

            form.appendChild(input);
            adjustWidth(input); // Adjust width of input

            input.addEventListener('input', function() {
                adjustWidth(this);
            });

            // Adding a break for better readability
            form.appendChild(document.createElement('br'));
        });

        // Add submit button to form
        const submitButton = document.createElement('button');
        submitButton.type = 'submit';
        submitButton.textContent = 'Save Configuration';
        form.appendChild(submitButton);

    } catch (error) {
        console.error('Failed to load configuration:', error);
    }

    // Event listener for form submission to save configuration
    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const formData = new FormData(form);
        const newConfig = {};

        for (const [key, value] of formData.entries()) {
            newConfig[key] = value;
        }

        await browser.runtime.sendMessage({
            action: "setConfig",
            config: newConfig
        });

        window.close(); 
    });
});


// Helper function to make input width grow dynamically
function adjustWidth(input) {
    let measurementSpan = document.getElementById('measurement-span');
    if (!measurementSpan) {
        measurementSpan = document.createElement('span');
        measurementSpan.id = 'measurement-span';
        measurementSpan.style.visibility = 'hidden';
        measurementSpan.style.position = 'absolute';
        measurementSpan.style.whiteSpace = 'pre';
        document.body.appendChild(measurementSpan);
    }
    
    // Apply the input's font style to the span for accurate measurement
    measurementSpan.style.font = window.getComputedStyle(input).font;
    
    // Set the span's content to the input's value or placeholder
    measurementSpan.textContent = input.value || input.placeholder;
    
    // Update the input's width based on the span's width
    input.style.width = `${measurementSpan.offsetWidth}px`;
}

