// Build navbar from menus dict
document.addEventListener('DOMContentLoaded', async () => {
    const navbar = document.getElementById('navbar');
    navbar.innerHTML = ''; // Clear existing navbar buttons if any

    Object.keys(menus).forEach(key => {
        const menu = menus[key];
        const button = document.createElement('button');
        button.innerHTML = menu.icon; // Sets the inner HTML to the SVG icon

        // Adjusted: Adding click event listener that switches tab and stores the choice
        button.addEventListener('click', () => {
            menus[key].func(); // Call the function to switch to the tab
            localStorage.setItem('lastOpenTab', key); // Store the last open tab
        });

        navbar.appendChild(button);
    });

    const expandButton = document.createElement('button');
    expandButton.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="-2.4 -2.4 28.8 28.8" xml:space="preserve" width="24" height="24" fill="#fff"><path d="M19.804 0h-4.516c-.831 0-1.492.681-1.492 1.492 0 .831.681 1.492 1.492 1.492h3.515l-4.932 4.97a1.516 1.516 0 0 0 0 2.135c.284.284.661.454 1.058.454s.813-.152 1.095-.434l4.97-4.932v3.496c0 .831.681 1.492 1.492 1.492.831 0 1.492-.681 1.492-1.492V4.156C24 1.888 22.071 0 19.804 0M9.977 7.956 5.045 3.004H8.54c.831 0 1.492-.681 1.492-1.492C10.032.681 9.35.02 8.54.02H4.044C1.776.02 0 1.909 0 4.176v4.498c0 .813.681 1.492 1.492 1.492.831 0 1.492-.681 1.492-1.492V5.159l4.895 4.932a1.484 1.484 0 0 0 2.098 0 1.516 1.516 0 0 0 0-2.135m12.53 5.953c-.831 0-1.492.681-1.492 1.492v3.495l-4.989-4.915c-.284-.284-.681-.434-1.077-.434s-.794.152-1.077.434a1.473 1.473 0 0 0 0 2.098l4.932 4.912h-3.515c-.831 0-1.492.681-1.492 1.492 0 .831.681 1.492 1.492 1.492h4.516c2.268 0 4.196-1.814 4.196-4.082v-4.475a1.51 1.51 0 0 0-1.492-1.512M8.56 21.014H5.047l4.932-4.912a1.496 1.496 0 0 0-1.058-2.552c-.397 0-.736.152-1.02.434l-4.895 4.933v-3.495c0-.831-.681-1.492-1.492-1.492-.831 0-1.492.681-1.492 1.492v4.498c0 2.266 1.776 4.08 4.044 4.08h4.498c.831 0 1.492-.681 1.492-1.492 0-.831-.681-1.492-1.492-1.492"/>
    </svg>`
    expandButton.addEventListener('click', function() {
        browser.tabs.query({active: true, currentWindow: true}, function(tabs) {
            browser.tabs.sendMessage(tabs[0].id, {action: "showExpandedPopupScreen"});
        });
        window.close();
    }, false);
    navbar.appendChild(expandButton);
    

    // Determine which tab to open based on the last open tab stored in localStorage
    const lastOpenTab = localStorage.getItem('lastOpenTab') || 'config'; // Default to 'config'
    if (menus[lastOpenTab] && typeof menus[lastOpenTab].func === 'function') {
        menus[lastOpenTab].func(); // Switch to the last open tab
    }
});


const menus = {
    "config": {
        icon: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="24" height="24" fill="white" stroke="white">
        <path d="M19.43 12.98c.04-.32.07-.64.07-.98s-.03-.66-.07-.98l2.11-1.65c.19-.15.24-.42.12-.64l-2-3.46c-.12-.22-.39-.3-.61-.22l-2.49 1c-.52-.4-1.08-.73-1.69-.98l-.38-2.65c-.05-.23-.25-.4-.49-.4h-4c-.24 0-.44.17-.49.4l-.38 2.65c-.61.25-1.17.58-1.69.98l-2.49-1c-.22-.08-.49 0-.61.22l-2 3.46c-.12.22-.07.49.12.64l2.11 1.65c-.04.32-.07.64-.07.98s.03.66.07.98l-2.11 1.65c-.19.15-.24.42-.12.64l2 3.46c.12.22.39.3.61.22l2.49-1c.52.4 1.08.73 1.69.98l.38 2.65c.05.23.25.4.49.4h4c.24 0 .44-.17.49-.4l.38-2.65c.61-.25 1.17-.58 1.69-.98l2.49 1c.22.08.49 0 .61-.22l2-3.46c.12-.22.07-.49-.12-.64l-2.11-1.65zM12 15.5c-1.93 0-3.5-1.57-3.5-3.5s1.57-3.5 3.5-3.5 3.5 1.57 3.5 3.5-1.57 3.5-3.5 3.5z"/>
        </svg>`,
        func: createConfigScreen
    },
    "add": {
        icon: `<svg xmlns="http://www.w3.org/2000/svg" fill="#fff" width="24" height="24" viewBox="0 0 24 24" stroke="#fff"><g stroke-width="0"/><g stroke-linecap="round" stroke-linejoin="round"/><path d="M13.5 20a1.5 1.5 0 0 0 1.5-1.5 2.5 2.5 0 0 1 2.5-2.5 1.5 1.5 0 0 0 1.5-1.5v-3a.5.5 0 1 1 1 0v3a6.5 6.5 0 0 1-6.5 6.5h-7A2.5 2.5 0 0 1 4 18.5v-13A2.5 2.5 0 0 1 6.5 3h6a.5.5 0 1 1 0 1h-6A1.5 1.5 0 0 0 5 5.5v13A1.5 1.5 0 0 0 6.5 20zm2.291-.499a5.52 5.52 0 0 0 2.71-2.71A2.5 2.5 0 0 1 17.5 17a1.5 1.5 0 0 0-1.5 1.5c0 .356-.074.695-.209 1.001ZM18 6h2.5a.5.5 0 1 1 0 1H18v2.5a.5.5 0 1 1-1 0V7h-2.5a.5.5 0 1 1 0-1H17V3.5a.5.5 0 1 1 1 0zM8.5 9a.5.5 0 0 1 0-1h4a.5.5 0 1 1 0 1zm0 3a.5.5 0 1 1 0-1h7a.5.5 0 1 1 0 1zm0 3a.5.5 0 1 1 0-1h5a.5.5 0 1 1 0 1z"/></svg>`,
        func: createAddScreen
    }
}

const loadingSvg = `<svg width="24" height="24" viewBox="0 0 24 24" stroke="white" fill="white" xmlns="http://www.w3.org/2000/svg"><style>.spinner_I8Q1{animation:spinner_qhi1 .75s linear infinite}.spinner_vrS7{animation-delay:-.375s}@keyframes spinner_qhi1{0%,100%{r:1.5px}50%{r:3px}}</style><circle class="spinner_I8Q1" cx="4" cy="12" r="1.5"/><circle class="spinner_I8Q1 spinner_vrS7" cx="12" cy="12" r="3"/><circle class="spinner_I8Q1" cx="20" cy="12" r="1.5"/><script xmlns="" id="bw-fido2-page-script"/>
</svg>`;

const successSvg = `<svg viewBox="0 0 24 24" width="24" height="24" fill="none" !important xmlns="http://www.w3.org/2000/svg">
<path d="M4 12.6111L8.92308 17.5L20 6.5" stroke="#FFFFFFFF" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/>
</svg>`;

const errorSvg = `<svg width="24" height="24" viewBox="-4 -4 24.00 24.00" fill="none" xmlns="http://www.w3.org/2000/svg" stroke="#000000" stroke-width="0.00024">
<path d="M7.493 0.015 C 7.442 0.021,7.268 0.039,7.107 0.055 C 5.234 0.242,3.347 1.208,2.071 2.634 C 0.660 4.211,-0.057 6.168,0.009 8.253 C 0.124 11.854,2.599 14.903,6.110 15.771 C 8.169 16.280,10.433 15.917,12.227 14.791 C 14.017 13.666,15.270 11.933,15.771 9.887 C 15.943 9.186,15.983 8.829,15.983 8.000 C 15.983 7.171,15.943 6.814,15.771 6.113 C 14.979 2.878,12.315 0.498,9.000 0.064 C 8.716 0.027,7.683 -0.006,7.493 0.015 M8.853 1.563 C 9.967 1.707,11.010 2.136,11.944 2.834 C 12.273 3.080,12.920 3.727,13.166 4.056 C 13.727 4.807,14.142 5.690,14.330 6.535 C 14.544 7.500,14.544 8.500,14.330 9.465 C 13.916 11.326,12.605 12.978,10.867 13.828 C 10.239 14.135,9.591 14.336,8.880 14.444 C 8.456 14.509,7.544 14.509,7.120 14.444 C 5.172 14.148,3.528 13.085,2.493 11.451 C 2.279 11.114,1.999 10.526,1.859 10.119 C 1.618 9.422,1.514 8.781,1.514 8.000 C 1.514 6.961,1.715 6.075,2.160 5.160 C 2.500 4.462,2.846 3.980,3.413 3.413 C 3.980 2.846,4.462 2.500,5.160 2.160 C 6.313 1.599,7.567 1.397,8.853 1.563 M7.706 4.290 C 7.482 4.363,7.355 4.491,7.293 4.705 C 7.257 4.827,7.253 5.106,7.259 6.816 C 7.267 8.786,7.267 8.787,7.325 8.896 C 7.398 9.033,7.538 9.157,7.671 9.204 C 7.803 9.250,8.197 9.250,8.329 9.204 C 8.462 9.157,8.602 9.033,8.675 8.896 C 8.733 8.787,8.733 8.786,8.741 6.816 C 8.749 4.664,8.749 4.662,8.596 4.481 C 8.472 4.333,8.339 4.284,8.040 4.276 C 7.893 4.272,7.743 4.278,7.706 4.290 M7.786 10.530 C 7.597 10.592,7.410 10.753,7.319 10.932 C 7.249 11.072,7.237 11.325,7.294 11.495 C 7.388 11.780,7.697 12.000,8.000 12.000 C 8.303 12.000,8.612 11.780,8.706 11.495 C 8.763 11.325,8.751 11.072,8.681 10.932 C 8.616 10.804,8.460 10.646,8.333 10.580 C 8.217 10.520,7.904 10.491,7.786 10.530 " stroke="none" fill-rule="evenodd" fill="#ffffff"/>
</svg>`;

async function createConfigScreen() {
    const contentDiv = document.getElementById('content');
    contentDiv.innerHTML = '';

    const form = document.createElement('form');
    contentDiv.appendChild(form);
    

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

            // Adding a break for better readability
            form.appendChild(document.createElement('br'));
        });

    } catch (error) {
        console.error('Failed to load configuration:', error);
    }

    // Event listener for form submission to save configuration
    const saveAction = async () => {
        const formData = new FormData(form);
        const newConfig = {};

        for (const [key, value] of formData.entries()) {
            newConfig[key] = value;
        }

        const response = await browser.runtime.sendMessage({
            action: "setConfig",
            config: newConfig
        });

        if (response.result !== "success")
            throw new Error(response.message);
    };

    saveButton = await createButtonWithStatus("Save", saveAction);

    contentDiv.appendChild(saveButton);
}

let maxHeight, maxWidth;
// Helper function to grow a textarea based on content
function adjustSize(textarea) {

    // If not already calculated, calculate max available height
    if (!maxHeight || !maxWidth) {
        const bodyComputedStyle = window.getComputedStyle(document.body);
        const maxBodyHeight = parseInt(bodyComputedStyle.maxHeight, 10) || 584; // Fallback to default max height
    
        // Calculate height of all elements
        let otherElementsHeight = [...document.body.children].reduce((total, element) => {
            return total + element.offsetHeight;
        }, 0);

        // Calculate height minus the textarea
        otherElementsHeight -= textarea.offsetHeight;

        // Display the final height in an alert
        maxHeight = maxBodyHeight - otherElementsHeight
        maxWidth = parseInt(bodyComputedStyle.maxWidth, 10) || 784; // Fallback to default max width
    }
    
    textarea.style.height = 'auto';
    textarea.style.height = `${Math.min(maxHeight, textarea.scrollHeight)}px`;

    // Ensure measuringSpan is created and styled
    let measuringSpan = document.getElementById('measuringSpan');
    if (!measuringSpan) {
        measuringSpan = document.createElement('span');
        measuringSpan.id = 'measuringSpan';
        measuringSpan.style.visibility = 'hidden';
        measuringSpan.style.position = 'absolute';
        measuringSpan.style.whiteSpace = 'pre';
        // Jank to ensure that measuringSpan doesn't get too tall
        measuringSpan.style.transform = 'translateY(-10000px)'; 
        document.body.appendChild(measuringSpan);
    }

    const computedStyle = window.getComputedStyle(textarea);
    measuringSpan.style.font = computedStyle.font;

    // Update measuringSpan content
    measuringSpan.textContent = textarea.value || textarea.placeholder;

    // Adjust width based on measuringSpan - ensure no maxWidth constraint
    textarea.style.width = `${Math.min(maxWidth, measuringSpan.offsetWidth + 30)}px`; 
}

async function createAddScreen() {
    const contentDiv = document.getElementById('content');
    contentDiv.innerHTML = ''; // Clear existing content

    // Create form elements
    const textareaFront = document.createElement('textarea');
    textareaFront.placeholder = 'Front of the flashcard';
    textareaFront.addEventListener('input', function() { adjustSize(this) });

    const inputBack = document.createElement('input');
    inputBack.type = 'text';
    inputBack.placeholder = 'Back of the flashcard';

    // Get cached input, if any
    const savedFrontInput = await browser.storage.local.get('cardFrontInput');
    textareaFront.value = savedFrontInput.cardFrontInput || ''; // Use saved value or default to empty string
    const savedBackInput = await browser.storage.local.get('cardBackInput');
    inputBack.value = savedBackInput.cardBackInput || '';

    // Janky workaround to fix the height not updating properly
    requestAnimationFrame(() => {
        adjustSize(textareaFront);
    });; // Adjust size after setting value


    // Listeners to update local storage whenever user types
    textareaFront.addEventListener('input', function() {
        adjustSize(this);
        browser.storage.local.set({ cardFrontInput: this.value });
    });
    inputBack.addEventListener('input', function() {
        browser.storage.local.set({ cardBackInput: this.value });
    });

    // Submit button function
    const submitAction = async () => {
        const cardFront = textareaFront.value;
        const cardBack = inputBack.value;
        if (!cardFront || !cardBack) 
            throw new Error(`${!cardFront ? "Front" : "Back"} is blank`);

        const response = await browser.runtime.sendMessage({
            action: 'addFlashcard',
            card_front: cardFront,
            card_back: cardBack
        });

        if(response.result !== "success") {
            throw new Error(response.message);
        }
    };

    const buttonWithStatus = await createButtonWithStatus('Add Flashcard', submitAction);

    contentDiv.appendChild(textareaFront);
    contentDiv.appendChild(inputBack);
    contentDiv.appendChild(buttonWithStatus); 
}

async function createButtonWithStatus(buttonText, actionFunction) {
    // Create the button
    const button = document.createElement('button');
    button.textContent = buttonText;

    // Create the status indicator div
    const statusIndicator = document.createElement('div');
    statusIndicator.id = 'statusIndicator'; // for styling

    // Create a container for the button and the status indicator
    const container = document.createElement('div');
    container.id = 'buttonsDiv'; 
    container.appendChild(button);
    container.appendChild(statusIndicator);

    // Attach the click event listener to the button
    button.addEventListener('click', async () => {
        button.disabled = true; // Disable the button to prevent multiple clicks
        statusIndicator.innerHTML = loadingSvg; // Show loading indicator

        try {
            // Await the action function
            await actionFunction();
            // On success, show the success indicator
            statusIndicator.innerHTML = successSvg;
            statusIndicator.title = ""; // Reset or set success title
        } catch (error) {
            // On error, show the error indicator and log the error
            statusIndicator.innerHTML = errorSvg;
            statusIndicator.title = error.message; // Show error message on hover
            console.error('Error:', error);
        } finally {
            button.disabled = false; // Re-enable the button
        }
    });

    return container; // Return the container for appending wherever needed
}
