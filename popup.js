// When popup opened, verify authentication and build UI
document.addEventListener('DOMContentLoaded', async () => {
    const contentDiv = document.getElementById('content');
    const loadingDiv = document.createElement('div');
    loadingDiv.id = "loading-div";
    loadingDiv.innerHTML = loadingSvg;
    contentDiv.appendChild(loadingDiv);

    const response = await browser.runtime.sendMessage({ action: "validateAuthentication" });
    if (!response.message || response.message !== "Authentication valid") {
        console.error("Not authenticated (does the user need to log in?)");
        createLoginScreen();
        return;
    }

    // If authenticated, create UI as usual
    createNavbar();

    // Determine which tab to open based on the last open tab stored in localStorage
    const lastOpenTab = localStorage.getItem('lastOpenTab') || 'config'; // Default to 'config'
    if (navbarButtons[lastOpenTab] && typeof navbarButtons[lastOpenTab].func === 'function') {
        navbarButtons[lastOpenTab].func(); // Switch to the last open tab
    }
});


const navbarButtons = {
    "profile": {
        icon: `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="-2 -2 28 28" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>`,
        func: createProfileScreen,
        isPersistent: true
    },
    "config": {
        icon: `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="#fff" stroke="#fff" viewBox="-500 -500 2820 2820">
        <path fill-rule="evenodd" d="M1703.534 960c0-41.788-3.84-84.48-11.633-127.172l210.184-182.174-199.454-340.856-265.186 88.433c-66.974-55.567-143.323-99.389-223.85-128.415L1158.932 0h-397.78L706.49 269.704c-81.43 29.138-156.423 72.282-223.962 128.414l-265.073-88.32L18 650.654l210.184 182.174C220.39 875.52 216.55 918.212 216.55 960s3.84 84.48 11.633 127.172L18 1269.346l199.454 340.856 265.186-88.433c66.974 55.567 143.322 99.389 223.85 128.415L761.152 1920h397.779l54.663-269.704c81.318-29.138 156.424-72.282 223.963-128.414l265.073 88.433 199.454-340.856-210.184-182.174c7.793-42.805 11.633-85.497 11.633-127.285m-743.492 395.294c-217.976 0-395.294-177.318-395.294-395.294 0-217.976 177.318-395.294 395.294-395.294 217.977 0 395.294 177.318 395.294 395.294 0 217.976-177.317 395.294-395.294 395.294"/>
        </svg>`,
        func: createConfigScreen,
        isPersistent: true
    },
    "expand": {
        icon: `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" class="icon" viewBox="-150 -150 1324 1324"><g fill="#fff"><path d="M128 469.333h85.333v85.334H128zm0-170.666h85.333V384H128zM128 640h85.333v85.333H128zm0-512h85.333v85.333H128zm0 682.667h85.333V896H128zM298.667 469.333H896v85.334H298.667zm0-170.666H896V384H298.667zm0 341.333H896v85.333H298.667zm0-512H896v85.333H298.667zm0 682.667H896V896H298.667z"/></g>
        </svg>`,
        func: async function() {
            browser.tabs.query({active: true, currentWindow: true}, function(tabs) {
                browser.tabs.sendMessage(tabs[0].id, {action: "showExpandedPopupScreen"});
            });
            window.close();
        },
        isPersistent: false
    },
    "add": {
        icon: `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="none" viewBox="0 0 24 24">
        <path fill="#fff" fill-rule="evenodd" d="M11.25 12.75V18h1.5v-5.25H18v-1.5h-5.25V6h-1.5v5.25H6v1.5h5.25Z" clip-rule="evenodd"/>
        </svg>`,
        func: createAddScreen,
        isPersistent: true
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

async function createNavbar() {
    const navbar = document.getElementById('navbar');
    navbar.innerHTML = ''; // Clear existing navbar buttons if any

    Object.keys(navbarButtons).forEach(key => {
        const menu = navbarButtons[key];
        const button = document.createElement('button');
        button.innerHTML = menu.icon; // Sets the inner HTML to the SVG icon

        // Adjusted: Adding click event listener that switches tab and stores the choice
        button.addEventListener('click', () => {
            navbarButtons[key].func(); // Call the function to switch to the tab
            if (navbarButtons[key].isPersistent) {
                localStorage.setItem('lastOpenTab', key);
            }
        });

        navbar.appendChild(button);
    });
}

async function createProfileScreen() {
    const contentDiv = document.getElementById('content');
    contentDiv.innerHTML = ''; // Clear existing content

    try {
        const { config } = await browser.runtime.sendMessage({ action: "getConfig" });

        const apiBaseUrlElement = document.createElement('p');
        apiBaseUrlElement.innerHTML = `Currently connected to:<br><code>${config.apiBaseUrl}</code>`;
        contentDiv.appendChild(apiBaseUrlElement);

        const logoutButton = document.createElement('button');
        logoutButton.textContent = 'Logout';
        logoutButton.addEventListener('click', async function() {
            try {
                const response = await browser.runtime.sendMessage({action: "logout"});

                const navbar = document.getElementById('navbar');
                navbar.innerHTML = ''; // Clear existing navbar buttons if any

                // Close any open overlays on logout
                browser.tabs.query({}, function(tabs) {
                    tabs.forEach(function(tab) {
                        browser.tabs.sendMessage(tab.id, {action: "forceClose"})
                        .catch(() => {
                            console.warn(`Failed closing overlay on ${tab.title} (tab ID ${tab.id})`);
                        })
                    });
                });

                createLoginScreen(); // Call createLoginScreen() after successful logout
            } catch (error) {
                console.error("Error with initiating logout:", error);
            }
        });
        contentDiv.appendChild(logoutButton);
    } catch (error) {
        console.error('Failed to load profile information:', error);
    }
}

async function createLoginScreen() {
    const contentDiv = document.getElementById('content');
    contentDiv.innerHTML = '';

    const form = document.createElement('form');
    form.id = 'configForm'; // Assign an ID to the form for easier reference
    contentDiv.appendChild(form);

    try {
        const { config } = await browser.runtime.sendMessage({ action: "getConfig" });

        const label = document.createElement('label');
        label.textContent = "API Base URL";
        label.htmlFor = "apiBaseUrl";
        form.appendChild(label);

        const input = document.createElement('input');
        input.id = "apiBaseUrl";
        input.value = config["apiBaseUrl"] || '';
        input.name = "apiBaseUrl";
        form.appendChild(input);

        const loginButton = document.createElement('button');
        loginButton.textContent = 'Login with Google';
        loginButton.type = 'submit'; // Ensure the button behaves as a submit button
        form.appendChild(loginButton); // Append the button to the form
    
        // Use the form submit event to capture form data and prevent default form submission
        form.addEventListener('submit', async (event) => {
            event.preventDefault(); // Prevent the form from submitting in the traditional way
    
            const formData = new FormData(form);
            config["apiBaseUrl"] = formData.get('apiBaseUrl'); // Update the apiBaseUrl
    
            try {
                // Set the new config
                await browser.runtime.sendMessage({
                    action: "setConfig",
                    config: config
                });
    
                // Proceed to login, using the newly set apiBaseUrl
                await browser.runtime.sendMessage({action: "login"});
            } catch (error) {
                console.error("Error with initiating login or setting config:", error);
            }
        });
    }
    catch (error) {
        console.error("Error while building login screen: ", error);
    }
}


async function createConfigScreen() {
    const contentDiv = document.getElementById('content');
    contentDiv.innerHTML = '';

    const form = document.createElement('form');
    contentDiv.appendChild(form);
    

    try {
        // Load the current configuration
        const { result, config }= await browser.runtime.sendMessage({ action: "getConfig" });

        // Dynamically create form inputs and labels based on config
        Object.keys(config).forEach(key => {
            if (key === "apiBaseUrl") return; // Shouldn't be able to change API Base URL after auth
            const label = document.createElement('label');
            label.textContent = key.charAt(0).toUpperCase() + key.slice(1); // Capitalize the first letter
            label.htmlFor = key;
            form.appendChild(label);

            const input = document.createElement('input');
            input.id = key;
            input.value = config[key] || '';
            input.name = key;

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
