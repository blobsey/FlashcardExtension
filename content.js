// content.js
// Handles UI/UX, application logic
(async function() {
    "use strict";
    
    // Set up main keyboard shortcut event listener
    document.addEventListener('keydown', handleKbInput);

    // Catches all keydown events and traps them if overlay is active
    function handleKbInput(event) {
        const { key, ctrlKey, shiftKey } = event;
        if (overlayDiv) {
            event.stopPropagation();
            event.stopImmediatePropagation();

            if (kbShortcuts.hasOwnProperty(key)) {
                event.preventDefault();
                kbShortcuts[key](event);
            }
        }
    }

    // Global variables for the root div and root of shadow DOM
    let root, shadowRoot;

    // Initialize overlay when DOM is loaded
    document.addEventListener('DOMContentLoaded', async function() {
        // Create Shadow DOM and load CSS from file
        root = document.createElement('div');
        document.body.appendChild(root);
        shadowRoot = root.attachShadow({ mode: 'open' });
        const cssFileUrl = browser.runtime.getURL('styles.css'); 
        const cssResponse = await fetch(cssFileUrl);
        const cssText = await cssResponse.text();
    
        const styleEl = document.createElement('style');
        styleEl.textContent = cssText;
        shadowRoot.appendChild(styleEl);
        
        // Listen for messages from the background script to show the overlay
        browser.runtime.onMessage.addListener((request, sender, sendResponse) => {
            (async () => {
                switch (request.action) {
                    case "showFlashcardAlarm":
                        attemptShowFlashcard();
                        sendResponse({ result: "success" });
                        break;
                    case "showExpandedPopupScreen":
                        showExpandedPopupScreen(request.screen);
                        sendResponse({ result: "success" });
                        break;
                    case "forceClose":
                        for (const screen in screens) {
                            screens[screen].active = false;
                        }
                        update();
                        sendResponse({ result: "success" });
                        break;
                    case "confirmAllTabs":
                        count = 0;
                        flashcard = null;
                        screens["flashcard"].active = false;
                        screens["confirm"].active = false;
                        update();
                        sendResponse({ result: "success" });
                        break;
                }
            })();

            return true;
        });

        // On page load, force check if need to show a flashcard
        attemptShowFlashcard();
        

        // On page load, if we are in blank.html then open screen specified by query parameter
        if (window.location.href.includes('blank.html')) {
            const { result, blankHtmlData } = await browser.runtime.sendMessage({ action: "getBlankHtmlData" });
            if (blankHtmlData.screenshotUri) {
                document.body.style.backgroundImage = `url(${blankHtmlData.screenshotUri})`;
                document.body.style.backgroundSize = 'cover';
            }

            if (blankHtmlData.tabTitle) 
                document.title = blankHtmlData.tabTitle;

            if (blankHtmlData.tabFaviconUrl) {
                const link = document.createElement('link');
                link.type = 'image/x-icon';
                link.rel = 'shortcut icon';
                link.href = blankHtmlData.tabFaviconUrl;
                document.getElementsByTagName('head')[0].appendChild(link);
            }

            const urlParams = new URLSearchParams(window.location.search);
            const screenToLoad = urlParams.get('screenToLoad') || 'list';
            showExpandedPopupScreen(screenToLoad);
        }

        // Prevents webpage from stealing focus when overlay is active
        function handleFocusIn(event) {
            // A bit hacky: if the webpage tries to steal focus, instead focus the first focusable overlay element
            // NOTE: event.preventDefault() doesnt work with focusin events
            if (overlayDiv && !overlayDiv.contains(event.target)) {
                // Find the first focusable element within the overlay
                const focusableElement = overlayDiv.querySelector(
                    'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
                );
                
                if (focusableElement) {
                    focusableElement.focus();
                } else {
                    overlayDiv.focus();
                }
            }
        }

        // Add focusin listener once overlay is bootstrapped
        document.addEventListener('focusin', handleFocusIn);
    });



    /////////////////////////////////
    // Application Logic Functions //
    /////////////////////////////////


    // Fetches userData
    async function getUserData() {
        try {
            const { result, data } = await browser.runtime.sendMessage({ action: "getUserData" });
            if (result !== "success") {
                throw new Error(JSON.stringify(data));
            }
            return data;
        }
        catch (error) {
            console.error("Error while fetching userdata: ", error);
        }
    }

    // Fetches a flashcard by sending a message to background.js
    async function fetchNextFlashcard(deck) {
        const userData = await getUserData();
        try {
            const response = await browser.runtime.sendMessage({
                action: "fetchNextFlashcard",
                deck: userData.deck
            });
            if (response.result !== "success") {
                throw new Error(JSON.stringify(response));
            }
            return response.flashcard;
        }
        catch (error) {
            console.error("Error while fetching next flashcard: ", error);
        }
    }
    
    // Edits a flashcard
    async function submitFlashcardEdit(card_id, frontText, backText) {
        const response = await browser.runtime.sendMessage({
            action: "editFlashcard",
            card_id: card_id,
            card_front: frontText,
            card_back: backText
        });
        if (response.result === "success") {
            return response.flashcard; // Return the updated flashcard for further processing
        } 
        else {
            // Handle failure
            console.error("Failed to update flashcard:", response.message);
            throw new Error(response.message); // Propagate the error to be handled by the caller
        }
    }

    // Deletes a flashcard
    async function submitFlashcardDelete(card_id) {
        try {
            const response = await browser.runtime.sendMessage({ action: "deleteFlashcard", card_id: card_id });
            if (response.result === "success") {
                return response;
            } 
            else {
                throw new Error(response.message);
            }
        } 
        catch (error) {
            console.error("Error deleting flashcard:", error);
            throw error;
        }
      }

    // Adds a flashcard
    async function submitFlashcardAdd(card_front, card_back, deck) {
        try {
            const response = await browser.runtime.sendMessage({
                action: "addFlashcard",
                card_front: card_front,
                card_back: card_back,
                deck: deck
            });
        
            if (response.result === "success") {
                return response;
            } 
            else {
                throw new Error(response.message);
            }
        } 
        catch (error) {
            console.error("Error adding flashcard:", error);
            throw error;
        }
    }
    

    // Iterates through DOM and pauses any media
    function pauseMediaPlayback() {
        const videoElements = Array.from(document.querySelectorAll('video'));
  
        const shadowRoots = Array.from(document.querySelectorAll('*')).map(el => el.shadowRoot).filter(Boolean);
        
        shadowRoots.forEach(shadowRoot => {
            const shadowVideoElements = Array.from(shadowRoot.querySelectorAll('video'));
            videoElements.push(...shadowVideoElements);
        });
        
        videoElements.forEach(videoElement => {
            if (!videoElement.paused) {
              videoElement.pause();
            }
        });
    }


    /* Helper function to call at page load and on "showFlashcardAlarm" alarms
    shows flashcard if site is in blocklist and if nextFlashcardTime has expired */
    async function attemptShowFlashcard() {
        const currentUrl = window.location.href;
        const currentTime = Date.now();
        try {
            const { nextFlashcardTime = currentTime } = await browser.storage.local.get("nextFlashcardTime");
    
            const userData = await getUserData();
    
            const isBlocked = userData.blocked_sites.some(site => {
                if (!site.active) return false;
    
                const blockedUrl = new URL(site.url);
                const currentUrl = new URL(window.location.href);
    
                return currentUrl.hostname === blockedUrl.hostname ||
                       currentUrl.hostname.endsWith('.' + blockedUrl.hostname);
            });
    
            if (isBlocked && nextFlashcardTime <= currentTime) {
                if (!flashcard) {
                    try {
                        flashcard = await fetchNextFlashcard();
                        if (flashcard) // Might be undefined if no flashcards to review 
                            showFlashcard();
                    }
                    catch (error) {
                        console.error("Error fetching flashcard: ", error);
                    }
                }
            }
        }
        catch (error) {
            console.error("Error while attempting to show flashcard: ", error);
        }
    }
    


    // Fetch flashcard, if it exists then bootstrap overlay
    async function showFlashcard() {
        // Calculate existing initial time grant, will be added to by grantTime()
        const { existingTimeGrant } = await browser.storage.local.get("existingTimeGrant");
        if (!existingTimeGrant) { // In case showFlashcard() gets called before "redeeming" time
            const currentTime = Date.now();
            const { nextFlashcardTime } = await browser.storage.local.get("nextFlashcardTime");
            const calculatedTimeGrant = nextFlashcardTime ? Math.max(nextFlashcardTime - currentTime, 0) : 0;
            await browser.storage.local.set({
                existingTimeGrant: calculatedTimeGrant
            });
        }

        pauseMediaPlayback();
        screens["flashcard"].activate();
    }

    function showExpandedPopupScreen(screen) {
        switch (screen) {
            case 'show':
                if (!flashcard) {
                    fetchNextFlashcard().then((data) => {
                        flashcard = data;
                        showFlashcard();
                    })
                    .catch((error) => {
                        console.error("Error while fetching flashcard: ", error);
                    });
                }
                break;
            case 'list':
                screens["list"].activate();
                break;
        }
    }
    

    ///////////////
    // UI System //
    ///////////////

    // Global state variables
    let overlayDiv = null; // Holds entire overlay
    let screenDiv = null; // Holds container for drawing screens
    let currentScreen = null; // Keeps track of currently displayed screen to avoid unnecessary re-draws
    let originalOverflowState = ''; // Original page scrolling behavior

    // For passing information between screens
    let count = 0; 
    let grade = null;
    let userAnswer = null;
    let flashcard = null;
    let nextFlashcard = null;
    let editFlashcard = null;
    let kbShortcuts = {};
    let screenshot = null;

    class Screen {
        constructor(render) {
            this.active = false;
            this.render = render;
        }
    
        activate() {
            this.active = true;
            update();
        }
    
        deactivate() {
            this.active = false;
            update();
        }
    }

    // Screens that are higher have more "priority", ex. if both edit and list are active, edit will be drawn
    const screens = {
        "addEdit": new Screen(createAddEditScreen),
        "list": new Screen(createListScreen),
        "confirm": new Screen(createConfirmScreen),
        "flashcard": new Screen(createFlashcardScreen)
    };

    function update() {
        // Draw highest priority screen
        const screen = getCurrentScreen();
        if (screen) {
            if (screen === currentScreen) {
                /* Hack to workaround race condition where
                overlay can be closed but some screens still active */
                overlayDiv = shadowRoot.getElementById('blobsey-flashcard-overlay'); 
                if (!overlayDiv)
                    for (const key in screens)
                        screens[key].active = false;
                return;
            }
            else {
                currentScreen = screen;
                kbShortcuts = {"Tab": trapFocus};
                createOverlayIfNotExists().then(() => {
                    screen.render();
                });
                return;
            }
        }

        // If no screens active, remove overlay
        if (overlayDiv) {
            overlayDiv.addEventListener('transitionend', function handler(e) {
                // Specifically check for the opacity transition to ensure correct removal
                if (e.propertyName === 'opacity') {
                    overlayDiv.remove();
                    overlayDiv.removeEventListener('transitionend', handler); // Clean up
                    overlayDiv = null;

                    /*  If current page is blank.html then it means that we failed to 
                        open the overlay on the previous page and then opened blank.html instead
                        so when closing the overlay, it should return to the previous page */
                    if (window.location.href.includes('blank.html')) {
                        window.history.back();
                    }
                }
            }, false);
        
            // Trigger the fade-out by setting opacity to 0
            overlayDiv.style.opacity = '0';
            overlayDiv.style.backdropFilter = 'blur(0px)'
        }

        if (screenshot)
            screenshot.remove();
        
        // Reset currentScreen 
        currentScreen = null;
        
        // Restore the original overflow state (scrolling behavior)
        document.documentElement.style.overflow = originalOverflowState;
    }

    // Iterates through "screens" to get the topmost active one (highest priority)
    function getCurrentScreen() {

        for (const key in screens) {
            if (screens[key].active) {
                return screens[key];
            }
        }
        return null; // If no active screens, return null
    }


    // Mimick default tab behavior, but only include overlay elements
    function trapFocus(event) {
        const focusableElements = Array.from(overlayDiv.querySelectorAll('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'));
        const focusedIndex = focusableElements.indexOf(shadowRoot.activeElement);

        // If current element is from overlay, find the next and focus it
        if (focusedIndex !== -1) {
            const nextIndex = event.shiftKey ? focusedIndex - 1 : focusedIndex + 1;
            focusableElements[(nextIndex % focusableElements.length)].focus();
        }
        else if (focusableElements.length > 0) {
            focusableElements[0].focus();
        }
        else {
            overlayDiv.focus();
        }
    }

    // Create overlay which darkens/blurs screen, prepare screenDiv for rendering
    async function createOverlayIfNotExists() {
        // Get the root div of the overlay and wipe it out
        overlayDiv = shadowRoot.getElementById('blobsey-flashcard-overlay');
        if (!overlayDiv) {
            screenshot = document.createElement('div');
            screenshot.id = "blobsey-flashcard-screenshot";
            shadowRoot.appendChild(screenshot);

            // Create blurred background from screenshot
            try {
                const { currentTab } = await browser.runtime.sendMessage({action: "getCurrentTab"});
                const { tab: thisTab } = await browser.runtime.sendMessage({action: "getThisTab"}); 
                if (currentTab.id !== thisTab.id)
                    throw new Error(); // To avoid screenshotting the wrong tab (fall back to normal CSS filters)

                const response = await browser.runtime.sendMessage({action: "captureTab"});
                screenshot.style.backgroundImage = `url(${response.screenshotUri})`;
                screenshot.style.backgroundSize = 'cover';
                screenshot.style.filter = 'blur(10px)';
                screenshot.style.transform = 'scale(1.03)';
            }
            catch (error) {
                screenshot.style.backdropFilter = 'blur(10px)';
                console.log(`Tab is not active tab, using (expensive) CSS filters!`);
            }
            finally {
                screenshot.style.transition = 'opacity .25s ease';
                screenshot.style.opacity = '0';
                setTimeout(() => {
                    screenshot.style.opacity = '1';
                }, 10);
            }
            originalOverflowState = document.documentElement.style.overflow;
            document.documentElement.style.overflow = 'hidden';
            overlayDiv = document.createElement('div');
            overlayDiv.id = 'blobsey-flashcard-overlay';
            overlayDiv.setAttribute('tabindex', '-1');
            shadowRoot.appendChild(overlayDiv);

            setTimeout(() => {
                overlayDiv.style.opacity = '1';
            }, 10);

            // Create container for current Screen
            screenDiv = document.createElement('div');
            screenDiv.classList.add('blobsey-flashcard-ui');
            overlayDiv.appendChild(screenDiv);
        }
    }

    /* Close Button takes in an onClick function, or 
    uses the default which closes all screens but "flashcard" */
    function createCloseButton(func = closeAllScreens) {
        const closeButton = document.createElement('button');
        closeButton.id = 'blobsey-flashcard-close-button';
        closeButton.addEventListener('click', func);
        screenDiv.appendChild(closeButton);
        
        // If close button is added, esc should also function as a close button
        kbShortcuts["Escape"] = func;
    }

    function closeAllScreens(prompt) {
        // If prompt exists and is a string, confirm before closing
        if (prompt && typeof prompt === "string" && !confirm(prompt))
            return;

        const screenKeys = Object.keys(screens);
        for (let i = screenKeys.length - 1; i >= 0; i--) {
            const screen = screenKeys[i];
            if (screen !== 'flashcard' && screen !== 'confirm') {
                screens[screen].active = false;
            }
        }
        update();
    }
    
    // Shows a flashcard and an input box for answering
    function createFlashcardScreen() {
        if (!flashcard) {
            screens["confirm"].activate();
            return;
        }

        screenDiv.innerHTML = '';

        const containerDiv = document.createElement('div');
        containerDiv.id = 'blobsey-flashcard-display-container'
        screenDiv.appendChild(containerDiv);

        const formattedCardFront = marked.parse(flashcard.card_front);
        const sanitizedCardFront = DOMPurify.sanitize(formattedCardFront);

        const frontDiv = document.createElement('div');
        frontDiv.id = 'blobsey-flashcard-frontDiv';
        frontDiv.innerHTML = sanitizedCardFront;
        containerDiv.appendChild(frontDiv);

        const userInput = document.createElement('input');
        userInput.type = 'text';
        userInput.placeholder = 'Type answer here'
        containerDiv.appendChild(userInput);

        userInput.addEventListener('keypress', (event) => {
            if (event.key === 'Enter') {
                event.preventDefault(); // Prevent the default action to avoid any unintended effects
                
                userAnswer = userInput.value;

                const isCorrect = userAnswer.trim().toLowerCase() === flashcard.card_back.trim().toLowerCase();
                if (isCorrect) { ++count; }
                grade = isCorrect ? 3 : 1;
    
                screens["confirm"].activate();
            }
        });


        userInput.focus();
    }

    function prettyPrintMilliseconds(milliseconds) {
        const totalSeconds = Math.floor(milliseconds / 1000);
        const hours = Math.floor(totalSeconds / 3600);
        const minutes = Math.floor((totalSeconds % 3600) / 60);
        const seconds = totalSeconds % 60;
        
        const parts = [
            { value: hours, unit: 'hour', className: 'blobsey-flashcard-hours' },
            { value: minutes, unit: 'minute', className: 'blobsey-flashcard-minutes' },
            { value: seconds, unit: 'second', className: 'blobsey-flashcard-seconds' }
        ];
    
        // Gonna return multiple DOM elements, so use a document fragment
        const fragment = document.createDocumentFragment();
    
        parts.forEach((part, index) => {
            if (part.unit === 'minute' || part.value > 0) {
                if (index > 0 && fragment.hasChildNodes()) {
                    fragment.appendChild(document.createTextNode(', '));
                }
                const span = document.createElement('span');
                span.className = part.className;
                span.textContent = `${part.value} ${part.unit}${part.value !== 1 ? 's' : ''}`;
                fragment.appendChild(span);
            }
        });
    
        return fragment;
    }
    
    

    ////////////////////
    // Confirm screen //
    ////////////////////

    // Helper function to calculate the nextFlashcardTime based on currentTime + calculated timeGrant
    async function grantTime(minutes) {
        try {
            // Fetch any time left, if any
            let { existingTimeGrant = 0 } = await browser.storage.local.get("existingTimeGrant");
            existingTimeGrant += minutes * 60000;

            await browser.storage.local.set({ existingTimeGrant });
        }
        catch (error) {
            console.error("Error while granting time: ", error);
        }
    }

    // Helper function to "redeem" time which clears out existingTimeGrant
    async function redeemTime() {
        try {
            /* Calculate nextFlashcardTime by taking the max of current nextFlashcardTime and the
            current time + existingTimeGrant (minimum +1 minute) */
            const { existingTimeGrant = 0 } = await browser.storage.local.get("existingTimeGrant");
            const { nextFlashcardTime = Date.now() } = await browser.storage.local.get("nextFlashcardTime");
            const response = await browser.runtime.sendMessage({
                action: "setTimestampAlarm",
                nextFlashcardTime: Math.max(nextFlashcardTime, Date.now() + Math.max(existingTimeGrant, 60000))
            });   
            if (response.result !== "success")
                throw new Error(JSON.stringify(response));

            await browser.storage.local.remove("existingTimeGrant");  
        }
        catch (error) {
            console.error("Error while redeeming time: ", error);
        }
    }

    function loadSvg(element, path) {
        element.innerHTML = '';
        const svgUrl = browser.runtime.getURL(`svg/${path}.svg`);
        const svgImg = document.createElement('img');
        svgImg.src = svgUrl;
        element.appendChild(svgImg);
    }

    // Shows review screen, really should be async because of strict ordering of review -> fetch -> display
    async function createConfirmScreen() {
        screenDiv.innerHTML = '';
        
        if (flashcard) {
            const formattedCardFront = marked.parse(flashcard.card_front || `<code>&lt;Flashcard missing&gt;</code>`);
            const sanitizedCardFront = DOMPurify.sanitize(formattedCardFront);

            const frontDiv = document.createElement('div');
            frontDiv.id = 'blobsey-flashcard-frontDiv';
            frontDiv.innerHTML = sanitizedCardFront;
            screenDiv.appendChild(frontDiv);

            // Line between front and back of card
            const dividerDiv = document.createElement('div');
            dividerDiv.id = 'blobsey-flashcard-divider';
            dividerDiv.classList.add('blobsey-flashcard-underline');
            screenDiv.appendChild(dividerDiv);
            
            const diffDiv = document.createElement('div');
            diffDiv.id = 'blobsey-flashcard-diffDiv';
        
            // User Answer Section
            const userAnswerLabel = document.createElement('strong');
            userAnswerLabel.classList.add('diff-label');
            userAnswerLabel.textContent = 'Your answer:';
            diffDiv.appendChild(userAnswerLabel);
        
            const userAnswerSpan = document.createElement('span');
            userAnswerSpan.classList.add('diff-answer');
            userAnswerSpan.textContent = userAnswer;
            diffDiv.appendChild(userAnswerSpan);
        
            // Correct Answer Section
            const correctAnswerLabel = document.createElement('strong');
            correctAnswerLabel.classList.add('diff-label');
            correctAnswerLabel.textContent = 'Correct answer:';
            diffDiv.appendChild(correctAnswerLabel);
        
            const correctAnswerSpan = document.createElement('span');
            correctAnswerSpan.classList.add('diff-answer');
            correctAnswerSpan.textContent = flashcard.card_back;
            diffDiv.appendChild(correctAnswerSpan);
        
            // Append the diffDiv to the screenDiv
            screenDiv.appendChild(diffDiv);
        }
        else {
            const flashcardDeletedDiv = document.createElement('div');
            flashcardDeletedDiv.innerHTML = '<code>?ltFlashcard missing?gt</code>';
            screenDiv.appendChild(flashcardDeletedDiv);
        }
        
        

        // Buttons container
        const buttonsDiv = document.createElement('div');
        buttonsDiv.id = "blobsey-flashcard-buttons-div";
        loadSvg(buttonsDiv, 'loadingSmall'); // Loading icon
        screenDiv.appendChild(buttonsDiv);

        if (grade) {
            try {
                await browser.runtime.sendMessage({
                    action: "reviewFlashcard",
                    card_id: flashcard.card_id,
                    grade: grade
                });
                
                if (grade === 3) {
                    await grantTime(1);
                }
            }
            catch (error) {
                console.error(error);
            }
        }

        const messageDiv = document.createElement('div');
        screenDiv.appendChild(messageDiv);

        // Fetch next flashcard if haven't already
        if (!nextFlashcard) {
            try {
                nextFlashcard = await fetchNextFlashcard();
                if (!nextFlashcard) {
                    messageDiv.textContent = "No more cards to review for today! :)";
                }
            }
            catch (error) {
                    messageDiv.textContent = error.message;
                    console.error(error);
            }
        }

        buttonsDiv.innerHTML = '';

        if (nextFlashcard) {
            const anotherButton = document.createElement('button');
            anotherButton.textContent = 'Another';
            anotherButton.onclick = () => {
                flashcard = nextFlashcard;
                nextFlashcard = null;
                screens["confirm"].deactivate();
            };
            buttonsDiv.appendChild(anotherButton);
        }

        // Add confirm button if at least one flashcard has been answered
        if (count > 0 || !nextFlashcard) {
            const confirmButton = document.createElement('button');
            confirmButton.textContent = 'Confirm';

            // Override closing function for close button to apply the timer
            const onClose = async () => {
                redeemTime(); 
                count = 0;
                flashcard = null;
                await browser.runtime.sendMessage({
                    action: "confirmAllTabs"
                });
            };
            createCloseButton(onClose);
            confirmButton.onclick = onClose;

            buttonsDiv.appendChild(confirmButton);
        }

        // Edit button
        if (flashcard) {
            const editButton = document.createElement('button');
            editButton.textContent = 'Edit';
            editButton.onclick = () => {
                editFlashcard = flashcard;
                screens["addEdit"].activate();
            };
            buttonsDiv.appendChild(editButton);
        }

        // Note for flashcard count
        const { existingTimeGrant } = await browser.storage.local.get("existingTimeGrant");
        const countNote = document.createElement('div');
        countNote.id = 'blobsey-flashcard-time-grant';
        screenDiv.appendChild(countNote);

        // Create the animation element
        const animationElement = document.createElement('span');
        animationElement.style.position = 'absolute';
        animationElement.style.color = '#90EE90';
        animationElement.style.fontSize = '14px';
        animationElement.style.opacity = '1';
        animationElement.style.transition = 'transform 3.0s, opacity 3.0s';
        screenDiv.appendChild(animationElement);

        // Function to start the animation
        function startAnimation() {
            const minutesElement = countNote.querySelector('.blobsey-flashcard-minutes');
            const minutesRect = minutesElement.getBoundingClientRect();
            animationElement.style.left = `${minutesRect.left - 8}px`;
            animationElement.style.top = `${minutesRect.top - 16}px`;
            animationElement.innerText = '+1';
            animationElement.style.opacity = '0';
            animationElement.style.transform = 'translateY(-10px)';

            // Increment the existingTimeGrant value after a short delay
            countNote.innerHTML = 'Time: ';
            countNote.appendChild(prettyPrintMilliseconds(existingTimeGrant));

            // Remove the animation element after the animation is complete
            setTimeout(() => {
                animationElement.remove();
            }, 3000);
        }

        // Start the animation after a 0.5-second delay
        if (grade && grade === 3) {
            countNote.innerHTML = 'Time: ';
            countNote.appendChild(prettyPrintMilliseconds(existingTimeGrant - 60000));
            setTimeout(startAnimation, 500);
            grade = null;
        }
        else {
            countNote.innerHTML = 'Time: ';
            countNote.appendChild(prettyPrintMilliseconds(existingTimeGrant));
        }
    }


    /////////////////////
    // Add/Edit Screen //
    /////////////////////

    // Helper function to make textarea grow vertically
    function adjustHeight(textarea) {
        const maxHeightVh = (window.innerHeight * 40) / 100; // 40vh == min height
        textarea.style.height = 'auto';
        textarea.style.height = `${Math.max(maxHeightVh, textarea.scrollHeight) + 10}px`;
    }

    function createAddEditScreen() {
        screenDiv.innerHTML = ''; // Clear current content

        screenDiv.style.opacity = '0'; // Fade in
        screenDiv.style.top = '10px'; // Slightly slide up
        screenDiv.style.position = 'relative'; // Set position to relative for the top property to take effect
    
        // Front textarea input
        const containerDiv = document.createElement('div');
        containerDiv.id = 'blobsey-flashcard-display-container';
        const frontInput = document.createElement('textarea');
        frontInput.value = editFlashcard ? editFlashcard.card_front : '';
        frontInput.placeholder = 'Front of Flashcard';
        frontInput.id = 'edit-screen-textarea-front'; 
    
        // Make textarea expand when typing more
        frontInput.addEventListener('input', function() { adjustHeight(this) });
    
        containerDiv.appendChild(frontInput);
        screenDiv.appendChild(containerDiv);
        frontInput.focus();
        
        adjustHeight(frontInput); // Initially fit textarea to content
    
        const backInput = document.createElement('input');
        backInput.type = 'text';
        backInput.value = editFlashcard ? editFlashcard.card_back : '';
        backInput.placeholder = 'Back of Flashcard';
        backInput.id = 'edit-screen-input-back'; 
        containerDiv.appendChild(backInput);
    
        const buttonsDiv = document.createElement('div');
        buttonsDiv.id = 'blobsey-flashcard-buttons-div'
        containerDiv.appendChild(buttonsDiv);

        // Save initial values so we can detect when editor is "dirty"
        const initialFrontValue = frontInput.value;
        const initialBackValue = backInput.value;
    
        // Function to close edit screen to pass in to cancel, save, delete, and close buttons
        const onClose = ((prompt = true) => {
            if ((typeof prompt === 'boolean' && !prompt) || (frontInput.value === initialFrontValue && backInput.value === initialBackValue) || confirm("Really close? (Unsaved edits will be lost)")) {
                editFlashcard = null;
                screenDiv.style.transition = ''; // Clean up animations on close
                screens["addEdit"].deactivate();
            }
        });

        // Close button
        createCloseButton(onClose);

        // Cancel button
        const cancelButton = document.createElement('button');
        cancelButton.textContent = 'Cancel';
        cancelButton.type = 'button';
        cancelButton.addEventListener('click', onClose);
        buttonsDiv.appendChild(cancelButton);
    
        // Delete button
        if (editFlashcard) {
            const deleteButton = document.createElement('button');
            deleteButton.textContent = 'Delete';
            deleteButton.type = 'button';
            deleteButton.addEventListener('click', async function() {
                if (confirm("Are you sure you want to delete this flashcard?")) {
                    try {
                        await submitFlashcardDelete(editFlashcard.card_id);
                        if (nextFlashcard && nextFlashcard.card_id === editFlashcard.card_id)
                            nextFlashcard = null;
                        if (flashcard && flashcard.card_id === editFlashcard.card_id)
                            flashcard = null;
                        showToast('Flashcard deleted. ', 10000); // TODO: add undo function (client side ??)
                        onClose(false);
                    }
                    catch (error) {
                        showToast(`Error while deleting flashcard: ${error}`, 10000);
                    }
                }
            });
            buttonsDiv.appendChild(deleteButton);
        }

        // Save button
        const saveButton = document.createElement('button');
        saveButton.textContent = 'Save';
        buttonsDiv.appendChild(saveButton);
    
        saveButton.addEventListener('click', async (event) => {
            event.preventDefault();
            try {
                if (editFlashcard)
                    flashcard = await submitFlashcardEdit(editFlashcard.card_id, frontInput.value, backInput.value);
                else
                    await submitFlashcardAdd(frontInput.value, backInput.value, deckSelect.selectedOption);
                onClose(false);
            }
            catch (error) {
                console.error("Error while adding/editing flashcard: ", error);
            }
        });
    
        // Trigger the transition animation
        requestAnimationFrame(() => {
            screenDiv.style.transition = 'opacity 0.1s ease, top 0.1s ease'; // Timings
            screenDiv.style.opacity = '1'; // Fade in
            screenDiv.style.top = '0px'; // Slightly slide up
            screenDiv.style.position = 'relative'; // Set position to relative for the top property to take effect
        });
    }

    function showToast(message, duration = 5000, undoFunction = null) {
        const toast = document.createElement('div');
        toast.classList.add('toast');
      
        const messageSpan = document.createElement('span');
        messageSpan.textContent = message;
        toast.appendChild(messageSpan);
      
        if (undoFunction) {
          const undoLink = document.createElement('a');
          undoLink.textContent = 'Undo';
          undoLink.href = '#';
          undoLink.addEventListener('click', (event) => {
            event.preventDefault();
            undoFunction();
            toast.remove();
          });
          toast.appendChild(undoLink);
        }
      
        screenDiv.appendChild(toast);
      
        setTimeout(() => {
          toast.remove();
        }, duration);
    }


    /////////////////
    // List Screen //
    /////////////////

    /* element: div of whole container
     * display: span showing the displayText of the selectedOption
     * optionsContainer: parent div for all option divs 
     * selectedOption: key of the currently selected option */
    class Dropdown {
        constructor() {
            this.element = document.createElement('div');
            this.element.className = 'blobsey-flashcard-dropdown';

            this.display = document.createElement('div');
            this.display.className = 'blobsey-flashcard-dropdown-display';
            loadSvg(this.display, 'loadingSmall');
            this.element.appendChild(this.display);

            this.optionsContainer = document.createElement('div');
            this.optionsContainer.className = 'blobsey-flashcard-dropdown-options';
            this.element.appendChild(this.optionsContainer);

            this.options = {}
            this.selectedOption = null;
            this.isDisabled = false;
            this.isOpen = false;

            this.element.addEventListener('mousedown', (event) => {
                if (event.button !== 0) // Only react on left click
                    return; 
                if (!this.isDisabled && event.target === this.element) {
                    if (this.isOpen) 
                        this.close();
                    else 
                        this.open();
                }
            });

            // Close when click off
            shadowRoot.addEventListener('click', (event) => {
                if (!this.element.contains(event.target)) {
                    this.close();
                }
            });
            window.addEventListener('blur', () => {
                this.close();
            });
        }

        addOption(key, element, selectable = true) {
            this.options[key] = { element, selectable };
            this.optionsContainer.appendChild(element);
            element.classList.add('blobsey-flashcard-dropdown-option');
        }

        disable(showLoading = false) {
            if (showLoading) 
                loadSvg(this.display, 'loadingSmall');
            this.isDisabled = true;
            this.element.classList.add('disabled');
            this.display.classList.add('disabled');
        }

        enable() {
            this.selectOption(this.selectedOption);
            this.isDisabled = false;
            this.element.classList.remove('disabled');
            this.display.classList.remove('disabled');
        }

        open() {
            if (!this.isDisabled) {
                this.element.classList.add('open');
                this.optionsContainer.classList.add('open');
                this.isOpen = true;
            }
        }

        close() {
            this.element.classList.remove('open');
            this.optionsContainer.classList.remove('open');
            this.isOpen = false;
        }

        selectOption(key) {
            const option = this.options[key];
            if (option && option.selectable) {
                if (this.options[this.selectedOption]) {
                    this.options[this.selectedOption].element.classList.remove('selected');
                }
                this.selectedOption = key;
                this.options[key].element.classList.add('selected');
            }
        }

        setDisplayText(displayText, italicize = false) {
            if (italicize)
                this.display.classList.add("italicize");
            else
                this.display.classList.remove("italicize");    
            this.display.textContent = displayText;
            this.element.style.maxWidth = `${this.display.offsetWidth + 20}px`; 
        }

        clearOptions() {
            this.options = {};
            this.selectedOption = null;
            this.optionsContainer.innerHTML = '';
            this.display.innerHTML = '';
        }
    }

    /* element: div that we "wrap" a context menu around
     * menu: div of menu that is attached to document  */
    class ContextMenuElement {
        constructor(displayDiv) {
            this.element = displayDiv;
            this.elementCopy = this.element.innerHTML;

            this.isDisabled = false;
            this.isOpen = false;
    
            this.menu = document.createElement('div');
            this.menu.className = 'blobsey-flashcard-context-menu-container';
            screenDiv.appendChild(this.menu);
            
            this.element.addEventListener('mousedown', (event) => {
                if (event.button !== 0) // Only react on left click
                    return; 
                if (this.isOpen) {
                    this.close();
                }
                else {
                    this.open();
                }
            });

            // Close when click off
            shadowRoot.addEventListener('mousedown', (event) => {
                if (event.button !== 0) // Only react on left click
                    return; 
                if (!this.element.contains(event.target) && !this.menu.contains(event.target)) {
                    this.close();
                }
            });
            window.addEventListener('blur', () => {
                this.close();
            });

            // Update position when resize window 
            window.addEventListener('resize', () => {
                if (this.isOpen) {
                  this.updateMenuPosition();
                }
            });
        }

        disable() {
            loadSvg(this.element, 'loadingSmall');
            this.close();
            this.isDisabled = true;
            this.element.classList.add('disabled');
        }

        enable() {
            this.element.innerHTML = this.elementCopy;
            this.isDisabled = false;
            this.element.classList.remove('disabled');
        }


        open() {
            if (this.isDisabled)
            return;
        
            const menuWidth = this.calculateMenuWidth();
            this.updateMenuPosition(menuWidth);
        
            this.isOpen = true;
            this.menu.classList.add('open');
        }
        
        calculateMenuWidth() {
            const hiddenMenu = document.createElement('div');
            hiddenMenu.className = 'blobsey-flashcard-context-menu-container';
            hiddenMenu.style.visibility = 'hidden';
            hiddenMenu.style.position = 'absolute';
            hiddenMenu.innerHTML = this.menu.innerHTML;
        
            document.body.appendChild(hiddenMenu);
            const menuWidth = hiddenMenu.getBoundingClientRect().width;
            document.body.removeChild(hiddenMenu);
        
            return menuWidth;
        }

        updateMenuPosition(menuWidth) {
            const elementRect = this.element.getBoundingClientRect();
            const spaceOnRight = window.innerWidth - elementRect.right;
        
            if (spaceOnRight >= menuWidth) {
                // Enough space on the right, grow from left to right
                this.menu.style.right = `unset`;
                this.menu.style.left = `${elementRect.right - 16}px`;
                this.menu.style.transformOrigin = 'left';
            } 
            else {
                // Not enough space on the right, grow from right to left
                this.menu.style.left = `unset`;
                this.menu.style.right = `${window.innerWidth - elementRect.left + 16}px`;
                this.menu.style.transformOrigin = 'right';
            }

            this.menu.style.top = `${elementRect.bottom - 16}px`;
        }

        close() {
            this.isOpen = false;
            this.menu.classList.remove('open');
        }

        addOption(element) {
            this.menu.appendChild(element);
        }

        clearOptions() {
            this.menu.innerHTML = '';
        }
    }

    class SetActiveDeckButton {
        static allButtons = new WeakMap();

        constructor(deck) {
            this.button = document.createElement('button');
            this.button.id = 'blobsey-flashcard-set-active-deck-button';
            this.deck = deck;

            // Load until state is loaded
            this.button.disabled = true;
            loadSvg(this.button, 'loadingSmall');
            getUserData().then((userData) => {
                this.updateButtonState(userData.deck);
            });

            SetActiveDeckButton.allButtons.set(this.button, this);

            this.button.addEventListener('click', async () => {
                try {
                    this.button.disabled = true;
                    loadSvg(this.button, 'loadingSmall');
                    await browser.runtime.sendMessage({
                        action: "setUserData",
                        userData: { deck: this.deck }
                    });

                    const buttons = shadowRoot.querySelectorAll('#blobsey-flashcard-set-active-deck-button');
                    buttons.forEach(button => {
                        const instance = SetActiveDeckButton.allButtons.get(button);
                        if (instance) {
                            const isActiveDeck = instance.deck === this.deck;
                            button.disabled = isActiveDeck;
                            button.textContent = isActiveDeck ? 'Active Deck' : 'Set Active Deck';
                        }
                    });

                    await updateDeckList(false);
                    const displayText = this.deck || "All flashcards";
                    showToast(`Set active deck to "${displayText}"`, 5000);
                }
                catch (error) {
                    console.error("Error setting active deck: ", error);
                    showToast(`Error setting active deck: ${error}`, 5000);
                }
            });
        }

        updateButtonState(activeDeck) {
            const isActiveDeck = this.deck === activeDeck;
            this.button.disabled = isActiveDeck;
            this.button.textContent = isActiveDeck ? 'Active Deck' : 'Set Active Deck';
        }
    }

    let searchText = '';
    let tableContainer;
    let scrollContainer;
    let deckSelect;
    let selectedOption = null;
    let flashcards;
    let deckThreeDots;
    let scrollPosition = 0;
    
    async function createListScreen() {
        screenDiv.innerHTML = ''; // Clear current content
        const fullscreenDiv = document.createElement('div');
        fullscreenDiv.id = 'blobsey-flashcard-fullscreen-div';
        screenDiv.appendChild(fullscreenDiv);
    
        // Create a drop-down menu for deck selection
        deckSelect = new Dropdown();
        fullscreenDiv.appendChild(deckSelect.element);

        // Create a three dots menu in top right pertaining to currently selected deck
        const deckThreeDotsIcon = document.createElement('span');
        deckThreeDotsIcon.textContent = '⋮';

        deckThreeDots = new ContextMenuElement(deckThreeDotsIcon);
        deckThreeDots.element.id = 'blobsey-flashcard-deck-threedots';
        fullscreenDiv.appendChild(deckThreeDots.element);

        // Refresh button
        const refreshButton = document.createElement('div');
        refreshButton.id = 'blobsey-flashcard-refresh-button';
        loadSvg(refreshButton, 'refresh');
        refreshButton.addEventListener('click', async (event) => {
            event.preventDefault();
            // Disallow press while loading
            if (refreshButton.classList.contains('disabled'))
                return;

            try {
                loadSvg(refreshButton,'loadingSmall');
                refreshButton.classList.add('disabled');
                deckSelect.disable(false);
                deckThreeDots.disable();
                await updateDeckList();
            }
            catch (error) {
                console.error("Failed to refresh deck: ", error);
            }
            finally {
                loadSvg(refreshButton, 'refresh');
                refreshButton.classList.remove('disabled');
                deckSelect.enable();
                deckThreeDots.enable();
            }
        });
        fullscreenDiv.appendChild(refreshButton);
    
        // Create a search bar
        const searchBar = document.createElement('input');
        searchBar.id = 'blobsey-flashcard-search-bar';
        searchBar.setAttribute('type', 'text');
        searchBar.setAttribute('placeholder', 'Search flashcards...');
        searchBar.addEventListener('input', () => {
            searchText = searchBar.value.trim();
            updateFlashcardList();
        });
        fullscreenDiv.appendChild(searchBar);
        searchBar.value = searchText;
        searchBar.focus();
    
        createCloseButton();
    
        // Create a container for the table
        scrollContainer = document.createElement('div');
        scrollContainer.id = 'blobsey-flashcard-list-container';
        fullscreenDiv.appendChild(scrollContainer);
    
        // tableContainer to hold table
        tableContainer = document.createElement('div');
        tableContainer.id = 'blobsey-flashcard-list-table-container';
        scrollContainer.appendChild(tableContainer);
        showLoadingScreen();
    
        await updateDeckList(); 
    }
    
    // Updates decklist and then if refreshDeck is true, load selectedDeck
    async function updateDeckList(refreshDeck = true) {
        try {
            const userData = await getUserData();
            userData.decks.unshift('');
            if (!selectedOption && selectedOption !== '') // Ugly hack because technically '' is valid
                selectedOption = userData.deck;

            deckSelect.clearOptions(); // Clear existing options

            // Populate deckSelect
            userData.decks.forEach(deck => {
                const optionDiv = document.createElement('div');

                // Main button
                const optionText = document.createElement('div');
                optionText.className = 'blobsey-flashcard-dropdown-option-text';
                const displayText = deck || "All flashcards"; // Deck with empty string signifies "All flashcards"
                optionText.textContent = (deck === userData.deck) ? `${displayText} (Active)` : displayText;
                if (!deck)
                    optionText.classList.add("italicize");
                optionText.addEventListener('click', async (event) => {
                    try {
                        // Select the option, updating selectedOption and loading deck
                        deckSelect.selectOption(deck);

                        // Set displayText, signifying if deck is '' (All flashcards)
                        deckSelect.setDisplayText(optionText.textContent, deck === '') 
                        selectedOption = deck; // Save globally to persist choice
                        deckSelect.close();

                        await loadDeck(deck);
                    }
                    catch (error) {
                        console.error("Error occurred when selecting deck: ", error);
                    }
                });
                optionDiv.appendChild(optionText);

                // Make a "three dots" button
                const threeDotsIcon = document.createElement('span');
                threeDotsIcon.className = 'blobsey-flashcard-threedots';
                threeDotsIcon.textContent = '⋮';

                const threeDots = new ContextMenuElement(threeDotsIcon);

                // Rename option in deck dropdown
                if (deck) {
                    const renameOption = document.createElement('div');
                    renameOption.textContent = 'Rename deck';
                    renameOption.addEventListener('click', async (event) => {
                        event.stopPropagation();
                        threeDots.close();
                        let newName = prompt(`Enter a new name for the deck "${deck}":`, deck);
                        if (newName && newName !== deck) {
                            const isRenamingSelectedDeck = deckSelect.selectedOption === deck;
                            const isRenamingActiveDeck = userData.deck === deck;
                            try {
                                deckSelect.disable(true);
                                if (isRenamingSelectedDeck) {
                                    showLoadingScreen();
                                    deckThreeDots.disable();
                                }
                                const response = await browser.runtime.sendMessage({
                                    action: "renameDeck",
                                    oldDeckName: deck,
                                    newDeckName: newName
                                });
                                if (response.result !== "success") {
                                    const message = response.message || response.detail;
                                    throw new Error(message);
                                }
                                
                                showToast(`Deck "${deck}" renamed to "${newName}"`, 10000);
                            } 
                            catch (error) {
                                newName = deck;
                                showToast(error.message, 10000);
                                console.error("Error while renaming deck: ", error);
                            } 
                            finally {
                                const userData = await getUserData();
                                if (isRenamingSelectedDeck) {
                                    deckSelect.selectOption(newName);
                                    selectedOption = newName;
                                    deckSelect.setDisplayText((selectedOption === userData.deck) ? `${selectedOption} (Active)` : selectedOption);
                                }
    
                                // In case displayed flashcard is from renamed deck
                                if (isRenamingActiveDeck) {
                                    if (screens["flashcard"].active) {
                                        flashcard = null;
                                        showFlashcard();
                                    }
                                }

                                await updateDeckList();
                                deckSelect.enable();
                                deckSelect.open();
                                deckThreeDots.enable();
                            }
                        }
                    });
                    threeDots.addOption(renameOption);
                }

                // Add a "Set as active deck" to every threeDots in deck dropdown
                const setActiveOption = new SetActiveDeckButton(deck);
                setActiveOption.button.addEventListener('click', () => {
                    threeDots.close();
                    setTimeout(() => { // Ugly hack to reopen deck dropdown
                        deckSelect.open();
                    }, 250);
                });
                threeDots.addOption(setActiveOption.button);

                if (deck) {
                    const deleteOption = document.createElement('div');
                    deleteOption.textContent = 'Delete deck';
                    deleteOption.addEventListener('click', async (event) => {
                        const isDeletingSelectedDeck = deckSelect.selectedOption === deck;
                        if (confirm(`Are you sure you want to delete the deck "${deck}"?`)) {
                            try {
                                deckThreeDots.disable();
                                deckSelect.disable(true);
                                if (isDeletingSelectedDeck) {
                                    showLoadingScreen();
                                }
                                await browser.runtime.sendMessage({
                                    action: "deleteDeck",
                                    deck: deck
                                });
                                if (isDeletingSelectedDeck) {
                                    selectedOption = "";
                                    flashcard = null; 
                                }
                                await updateDeckList();
                                showToast(`Deck "${deck}" deleted`, 10000);
                            } 
                            catch (error) {
                                showToast(error.message, 10000);
                                console.error("Error while deleting deck: ", error);
                            }
                            finally {
                                deckThreeDots.enable();
                                deckSelect.enable();
                                deckSelect.open();
                            }
                        }
                    });
                    threeDots.addOption(deleteOption);
                }
                
                const exportOption = document.createElement('div');
                exportOption.textContent = 'Export to CSV...';
                exportOption.addEventListener('click', async (event) => {
                    try {
                        threeDots.disable();
                        const response = await browser.runtime.sendMessage({
                            action: "downloadDeck",
                            deck: deck
                        });
                
                        if (response.result !== "success") {
                            throw new Error(response.message);
                        }
                
                        showToast(`Deck "${deck}" exported successfully`, 10000);
                    } 
                    catch (error) {
                        showToast(error.message, 10000);
                        console.error("Error while exporting deck: ", error);
                    } 
                    finally {
                        threeDots.enable();
                    }
                });
                threeDots.addOption(exportOption);


                optionDiv.appendChild(threeDots.element);

                deckSelect.addOption(
                    deck, 
                    optionDiv, 
                    true // selectable
                );
            });
        
            // Add "Create Deck" option
            const createDeck = document.createElement('div');
            createDeck.textContent = 'Create new deck...';
            createDeck.className = 'blobsey-flashcard-dropdown-option-text';
            const createDeckContextMenu = new ContextMenuElement(createDeck);

            const emptyDeckOption = document.createElement('div');
            emptyDeckOption.textContent = 'Create empty deck';
            emptyDeckOption.addEventListener('click', async (event) => {
                event.stopPropagation();
                const userData = await getUserData();
                createDeckContextMenu.close();
                createDeckContextMenu.disable();
                let counter = 1;
                let newDeckName;  
                do {
                    newDeckName = `Untitled Deck ${counter}`;
                    counter++;
                } while (userData.decks.includes(newDeckName));
            
                // Create deck with new name
                try {
                    await browser.runtime.sendMessage({
                        action: "createDeck",
                        deck: newDeckName
                    });
                    await updateDeckList(false);
                } 
                catch (error) {
                    console.error("Error while creating a new deck: ", error);
                }
                finally {
                    createDeckContextMenu.enable();
                }

            });
            createDeckContextMenu.addOption(emptyDeckOption);

            const importOption = document.createElement('div');
            importOption.textContent = 'Import...';
            importOption.addEventListener('click', async (event) => {
                event.stopPropagation();
                const fileInput = document.createElement('input');
                fileInput.type = 'file';
                fileInput.accept = '.anki2,.csv';
                fileInput.style.display = 'none';
                screenDiv.appendChild(fileInput);
            
                fileInput.onchange = async (e) => {
                    const file = e.target.files[0];
                    if (file) {
                        try {
                            deckSelect.disable(true);
                            const deckName = file.name.replace(/\.(anki2|csv)$/, '');

                            // If deck name already exists, add a monotonically increasing number to it
                            let counter = 1;
                            let duplicateDeckName = null;
                            while (userData.decks.includes(duplicateDeckName)) {
                                counter++;
                                duplicateDeckName = `${deckName} ${counter}`;
                            }

                            // Create the deck first
                            const createDeckResp = await browser.runtime.sendMessage({
                                action: "createDeck",
                                deck: duplicateDeckName || deckName
                            });

                            if (createDeckResp.result !== "success") {
                                throw new Error(JSON.stringify(createDeckResp));
                            }
                            
                            // Upload to the newly created deck
                            const response = await browser.runtime.sendMessage({
                                action: "uploadDeck",
                                file: file,
                                deck: duplicateDeckName || deckName
                            });
            
                            if (response.result !== "success") {
                                throw new Error(JSON.stringify(response));
                            } 

                            showToast(response.message, 10000);
                            await updateDeckList();
                        } 
                        catch (error) {
                            showToast(`An error occurred while importing the deck: ${error}`, 10000);
                            console.error("Error while importing deck: ", error);
                        } 
                        finally {
                            deckSelect.enable();
                            deckSelect.open()
                        }
                    }
                    screenDiv.removeChild(fileInput);
                };
            
                fileInput.click();
            });
            createDeckContextMenu.addOption(importOption);

            deckSelect.addOption(
                "create", // key
                createDeck, // element
                false // selectable
            );

            // Try to select the already selected option, fallback to null (All flashcards)
            deckSelect.selectOption(selectedOption);
            let selectedOptionText = selectedOption || "All flashcards";
            if (userData.deck === selectedOption) 
                selectedOptionText += ' (Active)';
            deckSelect.setDisplayText(selectedOptionText, selectedOption === '');

            if (refreshDeck)
                await loadDeck(selectedOption);
        } 
        catch (error) {
            console.error("Error while fetching user data: ", error);
        }
    }

    function showLoadingScreen() {
        if (!shadowRoot.getElementById("blobsey-flashcard-loading-div")) {
            tableContainer.innerHTML = '';
            const loadingDiv = document.createElement('div');
            loadingDiv.id = "blobsey-flashcard-loading-div";
            loadSvg(loadingDiv,'loadingBig');
            tableContainer.appendChild(loadingDiv); 
        }
    }
    
    async function loadDeck(deck) {
        flashcards = null; // Should be null just in case user enters something into search bar while loading

        showLoadingScreen();

        try {
            const response = await browser.runtime.sendMessage({
                action: "listFlashcards",
                deck: deck
            });
            if (response.result === "success") {
                flashcards = response.flashcards || [];
            }
        }
        catch (error) {
            flashcards = null;
            tableContainer.textContent = error;
            console.error("Error while loading deck: ", error);
        }
        finally {
            updateFlashcardList();
        }
    }
    
    function updateFlashcardList() {
        if (!flashcards) {
            return;
        }

        // Also construct three dots in top right, wiping out any existing
        deckThreeDots.clearOptions();

        // "Add Flashcard" option
        if (deckSelect.selectedOption !== '') {
            const addFlashcardOption = document.createElement('div');
            addFlashcardOption.textContent = 'Add flashcard';
            addFlashcardOption.addEventListener('click', (event) => {
                editFlashcard = null;
                screens['addEdit'].activate();
            });
            deckThreeDots.addOption(addFlashcardOption);
        }
        
        // Add Set Active Deck button to selectedDeck threeDots menu
        const setActiveDeckButton = new SetActiveDeckButton(deckSelect.selectedOption);
        deckThreeDots.addOption(setActiveDeckButton.button);
    
        tableContainer.innerHTML = ''; // Clear existing content
    
        const table = document.createElement('table');
        table.id = 'blobsey-flashcard-list-table';
        tableContainer.appendChild(table);
    
        const tbody = document.createElement('tbody');
        table.appendChild(tbody);
    
        const filteredFlashcards = flashcards.filter(card =>
            card.card_front.toLowerCase().includes(searchText.toLowerCase()) ||
            card.card_back.toLowerCase().includes(searchText.toLowerCase())
        );
    
        if (filteredFlashcards.length === 0) {
            const cat = document.createElement('div');
            cat.id = 'blobsey-flashcard-cat';
            loadSvg(cat, 'cat');
            tableContainer.appendChild(cat);

            const noFlashcardsFoundDiv = document.createElement('div');
            noFlashcardsFoundDiv.textContent = 'No flashcards found';
            cat.appendChild(noFlashcardsFoundDiv);
        }
        else {
            filteredFlashcards.forEach(card => {
                const row = document.createElement('tr');
                const frontCell = document.createElement('td');
                frontCell.textContent = card.card_front;
                const backCell = document.createElement('td');
                backCell.textContent = card.card_back;
                row.appendChild(frontCell);
                row.appendChild(backCell);
                tbody.appendChild(row);

                // Add click event listener to each row
                row.addEventListener('click', function() {
                    scrollPosition = scrollContainer.scrollTop; // Save scroll position when leaving list screen
                    editFlashcard = card; // Update the global variable with the selected flashcard
                    screens["addEdit"].activate(); // Switch to the edit screen
                });
            });

            scrollContainer.scrollTop = scrollPosition; // Restore saved scroll position, if any
        }
    }

    
})();
