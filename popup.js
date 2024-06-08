function loadSvg(element, path) {
    element.innerHTML = '';
    const svgUrl = browser.runtime.getURL(`svg/${path}.svg`);
    const svgImg = document.createElement('img');
    svgImg.src = svgUrl;
    element.appendChild(svgImg);
}

// When popup opened, verify authentication and build UI
document.addEventListener('DOMContentLoaded', async () => {
    const contentDiv = document.getElementById('content');
    const loadingDiv = document.createElement('div');
    loadingDiv.id = "loading-div";
    loadSvg(loadingDiv, 'loadingSmall');
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
        loadSvg(backButton, 'back');
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

            try {
                const response = await browser.runtime.sendMessage({
                    action: "setUserData",
                    userData: {
                        max_new_cards: maxNewCardsInput.value || null,
                        deck: deckSelect.value,
                        blocked_sites: blockedSites
                    }
                });

                if (response.result !== "success") 
                    throw new Error(JSON.stringify(response));
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
        nullOption.value = "";
        nullOption.textContent = "<all flashcards>";
        nullOption.style.fontStyle = "italic";
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

                // Active flag checkbox
                const activeCheckbox = document.createElement('input');
                activeCheckbox.className = 'activeCheckbox';
                activeCheckbox.type = 'checkbox';
                activeCheckbox.checked = site.active;
                activeCheckbox.onchange = () => {
                    site.active = activeCheckbox.checked;
                    saveFunc();
                };
                siteEntry.appendChild(activeCheckbox);

                // Blocked URL display text
                const urlDisplay = document.createElement('div');
                urlDisplay.textContent = site.url;
                siteEntry.appendChild(urlDisplay);
                
                const confirmFunc = () => {
                    site.url = urlInput.value;
                    saveFunc();
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

                // Hidden confirm button to save change
                const confirmButton = document.createElement('button');
                confirmButton.className = 'confirmButton';
                confirmButton.style.display = 'none';
                confirmButton.onclick = confirmFunc;
                siteEntry.appendChild(confirmButton);

                // Edit button
                const editButton = document.createElement('button');
                editButton.className = 'editButton';
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
                deleteButton.onclick = () => {
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
            addNewBlockedSite.addEventListener('click', () => {
                blockedSites.push({
                    url: 'https://',
                    active: true
                });
                saveFunc();
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
        // Jank to ensure that measuringSpan doesn't affect scrolling of page
        measuringSpan.style.transform = 'translateX(-100000px) translateY(-100000px)'; 
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

    // Deck select
    const deckSelect = document.createElement('select');
    deckSelect.id = 'deckSelect-addScreen';
    deckSelect.name = 'deck';

    // Add blank option, disallow adding to it
    const nullOption = document.createElement('option');
    nullOption.value = "";
    nullOption.textContent = "<select a deck>";
    nullOption.style.fontStyle = "italic";
    nullOption.selected = true;
    nullOption.disabled = true;
    nullOption.hidden = true;

    deckSelect.appendChild(nullOption);

    const applyPlaceholderStyle = () => {
        if (deckSelect.value === "") { 
            deckSelect.classList.add('placeholder');
        } else {
            deckSelect.classList.remove('placeholder');
        }
    }

    deckSelect.addEventListener('change', () => {
        applyPlaceholderStyle();
        browser.storage.local.set({ savedDeckSelection: deckSelect.value });
    });


    const { result, data: userData } = await browser.runtime.sendMessage({ action: "getUserData" });
    const { savedDeckSelection } = await browser.storage.local.get('savedDeckSelection');
    const selectedDeck = savedDeckSelection || userData.deck;

    userData.decks.forEach(deck => {
        const option = document.createElement('option');
        option.value = deck;
        option.textContent = deck;
        if (deck === selectedDeck) {
            option.selected = true;
        }
        deckSelect.appendChild(option);
    });

    applyPlaceholderStyle(); // If selected option is "" then apply placeholder style (make less opaque)

    // 'Pop out' button
    const popOutButton = document.createElement('button');
    popOutButton.id = 'pop-out-button';
    loadSvg(popOutButton, 'popout');
    popOutButton.addEventListener('click', async (event) => {
        const popup = await browser.windows.create({
            url:  browser.runtime.getURL(`blank.html?screenToLoad=add`),
            type: 'popup',
            width: 500,
            height: 600
        });
    });
    contentDiv.appendChild(popOutButton);


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
        
        if (deckSelect.value === '') {
            throw new Error(`Please select a deck`);
        }

        const response = await browser.runtime.sendMessage({
            action: 'addFlashcard',
            card_front: cardFront,
            card_back: cardBack,
            deck: deckSelect.value
        });

        if(response.result !== "success") {
            throw new Error(response.message);
        }
        else {
            return { 
                card_id: response.card_id.slice(0, 4) + "..." + response.card_id.slice(-4), 
                card_front: response.card_front, 
                card_back: response.card_back 
            };
        }
    };

    const buttonWithStatus = createButtonWithStatus('Add Flashcard', submitAction);

    contentDiv.appendChild(deckSelect);
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
        loadSvg(statusIndicator, 'loadingSmall'); // Show loading

        try {
            // Await the action function
            const response = await actionFunction(event);
            // On success, show the success indicator
            loadSvg(statusIndicator, 'checkmark');

            // Show the response on hover
            statusIndicator.title = response ? JSON.stringify(response, null, 2).replace(/\\n/g, '\n') : '';
        } catch (error) {
            // On error, show the error indicator and log the error
            loadSvg(statusIndicator, 'error');
            statusIndicator.title = error.message; // Show error message on hover
            console.error('Error:', error);
        } finally {
            button.disabled = false; // Re-enable the button
        }
    });

    return container; // Return the container for appending wherever needed
}