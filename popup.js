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

    // Determine which tab to open based on the last open tab stored in localStorage
    const lastOpenTab = localStorage.getItem('lastOpenTab') || 'config'; // Default to 'config'
    if (menus[lastOpenTab] && typeof menus[lastOpenTab].func === 'function') {
        menus[lastOpenTab].func(); // Switch to the last open tab
    }
});


const menus = {
    "config": {
        icon: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="24" height="24">
        <path d="M19.43 12.98c.04-.32.07-.64.07-.98s-.03-.66-.07-.98l2.11-1.65c.19-.15.24-.42.12-.64l-2-3.46c-.12-.22-.39-.3-.61-.22l-2.49 1c-.52-.4-1.08-.73-1.69-.98l-.38-2.65c-.05-.23-.25-.4-.49-.4h-4c-.24 0-.44.17-.49.4l-.38 2.65c-.61.25-1.17.58-1.69.98l-2.49-1c-.22-.08-.49 0-.61.22l-2 3.46c-.12.22-.07.49.12.64l2.11 1.65c-.04.32-.07.64-.07.98s.03.66.07.98l-2.11 1.65c-.19.15-.24.42-.12.64l2 3.46c.12.22.39.3.61.22l2.49-1c.52.4 1.08.73 1.69.98l.38 2.65c.05.23.25.4.49.4h4c.24 0 .44-.17.49-.4l.38-2.65c.61-.25 1.17-.58 1.69-.98l2.49 1c.22.08.49 0 .61-.22l2-3.46c.12-.22.07-.49-.12-.64l-2.11-1.65zM12 15.5c-1.93 0-3.5-1.57-3.5-3.5s1.57-3.5 3.5-3.5 3.5 1.57 3.5 3.5-1.57 3.5-3.5 3.5z"/>
        </svg>`,
        func: createConfigScreen
    },
    "add": {
        icon: `<svg xmlns="http://www.w3.org/2000/svg" fill="#ffffff" width="24" height="24" viewBox="0 0 24 24" stroke="#ffffff">
        <g id="SVGRepo_bgCarrier" stroke-width="0"/>
        <g id="SVGRepo_tracerCarrier" stroke-linecap="round" stroke-linejoin="round"/>
        <g id="SVGRepo_iconCarrier"> <path d="M13.5,20 C14.3284271,20 15,19.3284271 15,18.5 C15,17.1192881 16.1192881,16 17.5,16 C18.3284271,16 19,15.3284271 19,14.5 L19,11.5 C19,11.2238576 19.2238576,11 19.5,11 C19.7761424,11 20,11.2238576 20,11.5 L20,14.5 C20,18.0898509 17.0898509,21 13.5,21 L6.5,21 C5.11928813,21 4,19.8807119 4,18.5 L4,5.5 C4,4.11928813 5.11928813,3 6.5,3 L12.5,3 C12.7761424,3 13,3.22385763 13,3.5 C13,3.77614237 12.7761424,4 12.5,4 L6.5,4 C5.67157288,4 5,4.67157288 5,5.5 L5,18.5 C5,19.3284271 5.67157288,20 6.5,20 L13.5,20 L13.5,20 Z M15.7913481,19.5014408 C16.9873685,18.9526013 17.9526013,17.9873685 18.5014408,16.7913481 C18.1948298,16.9255432 17.8561101,17 17.5,17 C16.6715729,17 16,17.6715729 16,18.5 C16,18.8561101 15.9255432,19.1948298 15.7913481,19.5014408 L15.7913481,19.5014408 Z M18,6 L20.5,6 C20.7761424,6 21,6.22385763 21,6.5 C21,6.77614237 20.7761424,7 20.5,7 L18,7 L18,9.5 C18,9.77614237 17.7761424,10 17.5,10 C17.2238576,10 17,9.77614237 17,9.5 L17,7 L14.5,7 C14.2238576,7 14,6.77614237 14,6.5 C14,6.22385763 14.2238576,6 14.5,6 L17,6 L17,3.5 C17,3.22385763 17.2238576,3 17.5,3 C17.7761424,3 18,3.22385763 18,3.5 L18,6 Z M8.5,9 C8.22385763,9 8,8.77614237 8,8.5 C8,8.22385763 8.22385763,8 8.5,8 L12.5,8 C12.7761424,8 13,8.22385763 13,8.5 C13,8.77614237 12.7761424,9 12.5,9 L8.5,9 Z M8.5,12 C8.22385763,12 8,11.7761424 8,11.5 C8,11.2238576 8.22385763,11 8.5,11 L15.5,11 C15.7761424,11 16,11.2238576 16,11.5 C16,11.7761424 15.7761424,12 15.5,12 L8.5,12 Z M8.5,15 C8.22385763,15 8,14.7761424 8,14.5 C8,14.2238576 8.22385763,14 8.5,14 L13.5,14 C13.7761424,14 14,14.2238576 14,14.5 C14,14.7761424 13.7761424,15 13.5,15 L8.5,15 Z"/> </g>
        </svg>`,
        func: createAddScreen
    }
}

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

        // Add submit button to form
        const submitButton = document.createElement('button');
        submitButton.type = 'submit';
        submitButton.textContent = 'Save';
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
}

// Helper function to grow a textarea based on content
function adjustSize(textarea) {
    // Ensure measuringSpan is created and styled
    let measuringSpan = document.getElementById('measuringSpan');
    if (!measuringSpan) {
        measuringSpan = document.createElement('span');
        measuringSpan.id = 'measuringSpan';
        measuringSpan.style.visibility = 'hidden';
        measuringSpan.style.position = 'absolute';
        measuringSpan.style.whiteSpace = 'pre';
        document.body.appendChild(measuringSpan);
    }

    const computedStyle = window.getComputedStyle(textarea);
    measuringSpan.style.font = computedStyle.font;

    // Update measuringSpan content
    measuringSpan.textContent = textarea.value || textarea.placeholder;

    // Adjust width based on measuringSpan - ensure no maxWidth constraint
    textarea.style.width = `${measuringSpan.offsetWidth + 20}px`; // Additional padding if necessary

    // Adjust height
    textarea.style.height = 'auto';
    textarea.style.height = `${textarea.scrollHeight}px`;
}

async function createAddScreen() {
    const contentDiv = document.getElementById('content');
    contentDiv.innerHTML = ''; // Clear existing content

    // Create form elements
    const form = document.createElement('form');
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
    

    const submitButton = document.createElement('button');
    submitButton.textContent = 'Add Flashcard';

    // Append elements to the form
    form.appendChild(textareaFront);
    form.appendChild(inputBack);
    form.appendChild(submitButton);
    contentDiv.appendChild(form);

    // Add event listener for the form submission
    form.addEventListener('submit', async (event) => {
        event.preventDefault();
        const cardFront = textareaFront.value;
        const cardBack = inputBack.value;

        // Send message to background.js to add the flashcard
        try {
            const response = await browser.runtime.sendMessage({
                action: 'addFlashcard',
                card_front: cardFront,
                card_back: cardBack
            });

            // Remove cached input
            browser.storage.local.remove(['cardFrontInput', 'cardBackInput']);
            console.log(response); // Log the response from background.js
            window.close();
        } catch (error) {
            console.error('Error adding flashcard:', error);
        }
    });
}
