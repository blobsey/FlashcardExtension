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

    updateNavbar();

    // Determine which tab to open based on the last open tab stored in localStorage
    const history = JSON.parse(localStorage.getItem('history')) || ['main'];
    const lastOpenMenu = history[history.length - 1];
    if (menuOptions[lastOpenMenu] && typeof menuOptions[lastOpenMenu].func === 'function') {
        menuOptions[lastOpenMenu].func(); // Switch to the last open tab
    }
});


async function updateNavbar() {
    const navbar = document.getElementById('navbar');
    navbar.innerHTML = ''; // Clear existing navbar buttons if any

    const history = JSON.parse(localStorage.getItem('history')) || ['main'];

    // If not on main menu, draw a back button
    if (history.length > 1) {
        const backButton = document.createElement('button');
        backButton.id = "backButton";
        backButton.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="2em" height="2em" fill="#fff" stroke="#fff" stroke-width="34.816" class="icon" viewBox="0 0 1024 1024">
        <path d="M669.6 849.6c8.8 8 22.4 7.2 30.4-1.6s7.2-22.4-1.6-30.4l-309.6-280c-8-7.2-8-17.6 0-24.8l309.6-270.4c8.8-8 9.6-21.6 2.4-30.4-8-8.8-21.6-9.6-30.4-2.4L360.8 480.8c-27.2 24-28 64-.8 88.8l309.6 280z"/>
        </svg>`;
        backButton.addEventListener('click', () => {
            history.pop();
            menuOptions[history[history.length - 1]].func();
            localStorage.setItem('history', JSON.stringify(history));
            updateNavbar();
        });
        navbar.appendChild(backButton);
    }
}

const menuOptions = {
    main: {
        label: "",
        func: createMainScreen,
        isPersistent: true
    },
    show: {
        label: "Show me a Flashcard",
        func: () => {
            expand("show")
            .catch((error) => { console.error("Error while calling expand: ", error); });
        },
        isPersistent: false
    },
    add: {
        label: "Add Flashcards",
        func: createAddScreen,
        isPersistent: true
    },
    list: {
        label: "List Flashcards",
        func: () => {
            expand("list")
            .catch((error) => { console.error("Error while calling expand: ", error); });
        },
        isPersistent: false
    },
    config: {
        label: "Settings",
        func: createConfigScreen,
        isPersistent: true
    },
    logout: {
        label: "Logout",
        func: async function () {
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
        },
        isPersistent: false
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


async function createMainScreen() {
    const contentDiv = document.getElementById('content');
    contentDiv.innerHTML = ''; // Clear existing content

    try {
        const { result, apiBaseUrl } = await browser.runtime.sendMessage({ action: "getApiBaseUrl" });
        const authInfo = await browser.runtime.sendMessage({ action: "authInfo" });

        const infoDiv = document.createElement('div');
        infoDiv.id = "info";
        contentDiv.appendChild(infoDiv);

        const apiBaseUrlDiv = document.createElement('div');
        apiBaseUrlDiv.innerHTML = `Connected to:<br><code>${apiBaseUrl}</code>`;
        infoDiv.appendChild(apiBaseUrlDiv);

        const idDiv = document.createElement('div');
        idDiv.innerHTML = `Logged in as <code>${authInfo["email"]}</code>`;
        infoDiv.appendChild(idDiv);

        const menu = document.createElement('div');
        menu.id = "menu";
        contentDiv.appendChild(menu);

        Object.keys(menuOptions).forEach(key => {
            if (key === "main") return; // Avoid blank option
            const menuOption = menuOptions[key];
            const button = document.createElement('button');
            button.textContent = menuOption.label;
    
            // Add clicked menu option to history, update navbar with back button
            button.addEventListener('click', () => {
                menuOption.func(); // Call the function to switch to the tab
                if (menuOption.isPersistent) {
                    const history = JSON.parse(localStorage.getItem('history')) || ['main'];
                    history.push(key);
                    localStorage.setItem('history', JSON.stringify(history));
                    updateNavbar();
                }
            });
    
            menu.appendChild(button);
        });
    } catch (error) {
        console.error('Failed to load main screen:', error);
    }
}

async function expand(screen) {
    let tabs = await browser.tabs.query({active: true, currentWindow: true});

    // Try to open overlay, if not possible then open in new tab
    try {
        await browser.tabs.sendMessage(tabs[0].id, {
            action: "showExpandedPopupScreen",
            screen: screen
        });
        window.close();
    }
    catch (error) {
        // Opening overlay not possible on current tab, try to open overlay on blank.html as fallback
        try {
            // Copy background, title, favicon of current tab
            const screenshotUri = await browser.tabs.captureVisibleTab();
            const tabTitle = tabs[0].title;
            const tabFaviconUrl = tabs[0].favIconUrl;

            // If we get an error when sending the message, redirect the current tab to blank.html
            await browser.runtime.sendMessage({ 
                action: "setBlankHtmlData", 
                data: {
                    screenshotUri: screenshotUri,
                    tabTitle: tabTitle,
                    tabFaviconUrl, tabFaviconUrl
                } 
            });
            await browser.tabs.update(tabs[0].id, {url: browser.runtime.getURL(`blank.html?screenToLoad=${screen}`)});
            window.close()
        }
        catch (error) {
            console.error("Fatal error when trying to open fallback overlay: ", error);
        }
    }
}

async function createLoginScreen() {
    const contentDiv = document.getElementById('content');
    contentDiv.innerHTML = '';

    const form = document.createElement('form');
    contentDiv.appendChild(form);

    try {
        const { result, apiBaseUrl } = await browser.runtime.sendMessage({ action: "getApiBaseUrl" });

        const label = document.createElement('label');
        label.textContent = "API Base URL";
        label.htmlFor = "apiBaseUrl";
        form.appendChild(label);

        const input = document.createElement('input');
        input.id = "apiBaseUrl";
        input.value = apiBaseUrl;
        input.name = "apiBaseUrl";
        form.appendChild(input);

        const loginButton = document.createElement('button');
        loginButton.textContent = 'Login with Google';
        loginButton.type = 'submit'; // Ensure the button behaves as a submit button
        form.appendChild(loginButton); // Append the button to the form
    
        // Use the form submit event to capture form data and prevent default form submission
        form.addEventListener('submit', async (event) => {
            event.preventDefault(); // Prevent the form from submitting in the traditional way
        
            try {
                // Set the new apiBaseUrl
                await browser.runtime.sendMessage({
                    action: "setApiBaseUrl",
                    apiBaseUrl: new FormData(form).get('apiBaseUrl')
                });
    
                // Proceed to login, using the newly set apiBaseUrl
                await browser.runtime.sendMessage({action: "login"});
            } catch (error) {
                console.error("Error with initiating login or setting API Base URL:", error);
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

    const form = document.createElement('div');
    contentDiv.appendChild(form);

    try {
        // Load the current user data
        const { result, data: userData } = await browser.runtime.sendMessage({ action: "getUserData" });

        if (result !== "success") {
            throw new Error(result);
        }

        let blockedSites = userData.blocked_sites.slice(); // convert userData blocked_sites to array

        // Function called whenever element changed
        const saveFunc = async (event) => {
            if (event)
                event.preventDefault();

            const updatedUserData = {
                max_new_cards: maxNewCardsInput.value || null,
                deck: deckSelect.value,
                blocked_sites: blockedSites
            };

            try {
                const { result } = await browser.runtime.sendMessage({
                    action: "setUserData",
                    userData: updatedUserData
                });

                if (result !== "success") 
                    throw new Error(result);
            } catch (error) {
                console.error("Error updating user data:", error);
            }
        };

        // Deck dropdown
        const deckLabel = document.createElement('label');
        deckLabel.textContent = 'Active Deck';
        form.appendChild(deckLabel);

        const deckSelect = document.createElement('select');
        deckSelect.name = 'deck';

        // Null option; if the "active" deck doesn't match any deck in list, it will show
        const nullOption = document.createElement('option');
        nullOption.value = "null";
        nullOption.innerHTML = "Select a deck...";
        nullOption.disabled = true;
        nullOption.hidden = true;
        nullOption.selected = true;
        deckSelect.appendChild(nullOption);

        userData.decks.forEach(deck => {
            const option = document.createElement('option');
            option.value = deck;
            option.textContent = deck;
            if (deck === userData.deck) {
                option.selected = true;
            }
            deckSelect.appendChild(option);
        });

        deckSelect.addEventListener('change', saveFunc);

        form.appendChild(deckSelect);
        
        // max_new_cards input field
        const maxNewCardsLabel = document.createElement('label');
        maxNewCardsLabel.textContent = 'New Cards/Day';
        form.appendChild(maxNewCardsLabel);

        const maxNewCardsInput = document.createElement('input');
        maxNewCardsInput.type = 'number';
        maxNewCardsInput.name = 'max_new_cards';
        maxNewCardsInput.value = userData.max_new_cards || '';
        maxNewCardsInput.step = '1'; // Set the step to 1 to allow only whole numbers
        maxNewCardsInput.min = '0'; // Set the minimum value to 0
        maxNewCardsInput.pattern = '\\d*'; // Set the pattern to allow only digits
        maxNewCardsInput.addEventListener('input', function() {
            this.value = this.value.replace(/[^0-9]/g, ''); // Remove any non-digit characters
        });
        maxNewCardsInput.addEventListener('change', saveFunc);
        form.appendChild(maxNewCardsInput);


        const blockedSitesLabel = document.createElement('label');
        blockedSitesLabel.textContent = 'Blocked Sites';
        form.appendChild(blockedSitesLabel);

        const blockedSitesList = document.createElement('div');
        blockedSitesList.id = 'blockedSitesList';
        form.appendChild(blockedSitesList);

        function refreshBlockedSitesUI() {
            blockedSitesList.innerHTML = '';

            blockedSites.forEach((site, index) => {
                const siteEntry = document.createElement('div');
                siteEntry.id = 'siteEntry';

                // Blocked URL display text
                const urlDisplay = document.createElement('div');
                urlDisplay.textContent = site.url;
                siteEntry.appendChild(urlDisplay);
                
                const confirmFunc = (event) => {
                    event.preventDefault();
                    site.url = urlInput.value;
                    saveFunc(event);
                    refreshBlockedSitesUI();
                }

                // Hidden input to show when editing
                const urlInput = document.createElement('input');
                urlInput.className = 'blockedSiteInput';
                urlInput.type = 'text';
                urlInput.value = site.url;
                urlInput.style.display = 'none';
                urlInput.addEventListener('keydown', (event) => {
                    if (event.key === 'Enter') {
                        event.preventDefault();
                        confirmFunc(event);
                    }
                });

                siteEntry.appendChild(urlInput);

                // Active flag checkbox
                const activeCheckbox = document.createElement('input');
                activeCheckbox.className = 'activeCheckbox';
                activeCheckbox.type = 'checkbox';
                activeCheckbox.checked = site.active;
                activeCheckbox.onchange = () => {
                    site.active = activeCheckbox.checked;
                };
                siteEntry.appendChild(activeCheckbox);

                // Hidden confirm button to save change
                const confirmButton = document.createElement('button');
                confirmButton.className = 'confirmButton';
                confirmButton.textContent = 'C';
                confirmButton.style.display = 'none';
                confirmButton.onclick = confirmFunc;
                siteEntry.appendChild(confirmButton);

                // Edit button
                const editButton = document.createElement('button');
                editButton.className = 'editButton';
                editButton.textContent = 'E';
                editButton.onclick = (event) => {
                    event.preventDefault();
                    urlInput.style.display = 'inline-block';
                    confirmButton.style.display = 'block';
                    urlDisplay.style.display = 'none';
                    editButton.style.display = 'none';
                    urlInput.focus();
                };
                siteEntry.appendChild(editButton);

                const deleteButton = document.createElement('button');
                deleteButton.className = 'deleteButton';
                deleteButton.textContent = 'D';
                deleteButton.onclick = (event) => {
                    event.preventDefault();
                    blockedSites.splice(index, 1);
                    saveFunc();
                    refreshBlockedSitesUI();
                };
                siteEntry.appendChild(deleteButton);

                blockedSitesList.appendChild(siteEntry);
            });

            const addNewBlockedSite = document.createElement('div');
            addNewBlockedSite.textContent = 'Add new site...';
            addNewBlockedSite.id = 'addNewBlockedSite';
            addNewBlockedSite.addEventListener('click', (event) => {
                blockedSites.push({
                    url: 'https://',
                    active: true
                });
                saveFunc(event);
                refreshBlockedSitesUI();

                // Select all edit buttons
                const editButtons = blockedSitesList.querySelectorAll('.editButton');
                // Access the last edit button using array access notation
                const lastEditButton = editButtons[editButtons.length - 1];

                if (lastEditButton) {
                    lastEditButton.click();
                }
            });
            blockedSitesList.append(addNewBlockedSite);
        }

        refreshBlockedSitesUI();

    } catch (error) {
        console.error('Failed to load user data:', error);
    }
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

        // Calculate max dimensions of textarea
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
    textarea.style.width = `${Math.min(maxWidth, measuringSpan.offsetWidth + 45)}px`; 
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

        const { result, data } = await browser.runtime.sendMessage({ action: "getUserData" });
        const deck = data.deck;
        if (!deck)
            throw new Error(`Deck is ${deck}`);

        const response = await browser.runtime.sendMessage({
            action: 'addFlashcard',
            card_front: cardFront,
            card_back: cardBack,
            deck: deck
        });

        if(response.result !== "success") {
            throw new Error(response.message);
        }
    };

    const buttonWithStatus = createButtonWithStatus('Add Flashcard', submitAction);

    contentDiv.appendChild(textareaFront);
    contentDiv.appendChild(inputBack);
    contentDiv.appendChild(buttonWithStatus); 
}

function createButtonWithStatus(buttonText, actionFunction) {
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
    button.addEventListener('click', async (event) => {
        button.disabled = true; // Disable the button to prevent multiple clicks
        statusIndicator.innerHTML = loadingSvg; // Show loading indicator

        try {
            // Await the action function
            await actionFunction(event);
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