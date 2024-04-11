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
            switch (request.action) {
                case "showFlashcard":
                    showFlashcard();
                    break;
                case "showExpandedPopupScreen":
                    showExpandedPopupScreen();
                    break;
                case "forceClose":
                    for (const screen in screens) {
                        screens[screen].active = false;
                    }
                    update();
                    break;
            }
        });

        
        // On page load, check if we should show the overlay
        browser.storage.local.get("nextFlashcardTime").then(data => {
            const currentTime = Date.now();

            // Check if the current site is in sitelist
            if (inSiteList(window.location.href)) {
                // Check if 'nextFlashcardTime' exists
                if (data.hasOwnProperty('nextFlashcardTime')) {
                    // 'nextFlashcardTime' exists, check if the current time is past this timestamp
                    if (currentTime >= data.nextFlashcardTime) {
                        showFlashcard(); // Time has passed, show the overlay
                    } // If time has not passed, do nothing and wait for the next alarm
                } else {
                    showFlashcard(); // 'nextFlashcardTime' probably got deleted, show anyways
                }
            }
        })
        .catch(error => {
            console.error("Error accessing storage in content script:", error);
        });

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
            screens[screenToLoad].activate();
        }


        // Add focusin listener once overlay is bootstrapped
        document.addEventListener('focusin', handleFocusIn);
    });



    /////////////////////////////////
    // Application Logic Functions //
    /////////////////////////////////

    // Fetches a flashcard by sending a message to background.js
    async function fetchNextFlashcard() {
        const response = await browser.runtime.sendMessage({action: "fetchNextFlashcard"});
        if (response.result === "error" || response.message) {
            throw new Error(response.message || "An unspecified error occurred");
        }
        return response.flashcard;
    }
    
    // Edits a flashcard
    async function submitFlashcardEdit(card_id, frontText, backText) {
        console.log(card_id, frontText, backText);
        const response = await browser.runtime.sendMessage({
            action: "editFlashcard",
            card_id: card_id,
            card_front: frontText,
            card_back: backText
        });    
        if (response.result === "success") {
            return response.flashcard; // Return the updated flashcard for further processing
        } else {
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
          } else {
            throw new Error(response.message);
          }
        } catch (error) {
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
          } else {
            throw new Error(response.message);
          }
        } catch (error) {
          console.error("Error adding flashcard:", error);
          throw error;
        }
    }
    

    // Sets alarm for "minutes" minutes to show next overlay
    function setTimer(minutes) {
        browser.runtime.sendMessage({
            action: "resetTimer",
            count: Math.max(1, minutes)
        }); // Send the current count with the message
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

    // Hardcoded list of sites (TODO: don't hardcode this lol)
    const sites = [
        'www.reddit.com',
        'www.youtube.com',
        'twitter.com',
        'www.tiktok.com',
        'crouton.net'
    ];

    // Function to check if the current site is allowed
    function inSiteList(url) {
        const hostname = new URL(url).hostname;
        return sites.some(site => hostname === site || hostname.endsWith('.' + site));
    }

    // Tries to show a flashcard, if there are none then sets a timer 1min from now to check again
    async function showFlashcard() {
        if (!flashcard) {
            try {
                flashcard = await fetchNextFlashcard();
            }
            catch (error) {
                if (error.message !== "No cards to review right now.")
                    console.error(error.message);
                setTimer(1);
                return;
            }
        }

        pauseMediaPlayback();
        screens["flashcard"].activate();
    }

    function showExpandedPopupScreen() {
        screens["list"].activate();
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
                createOverlayIfNotExists();
                screen.render();
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
    function createOverlayIfNotExists() {
        // Get the root div of the overlay and wipe it out
        overlayDiv = shadowRoot.getElementById('blobsey-flashcard-overlay');
        if (!overlayDiv) {
            originalOverflowState = document.documentElement.style.overflow;
            document.documentElement.style.overflow = 'hidden';
            overlayDiv = document.createElement('div');
            overlayDiv.id = 'blobsey-flashcard-overlay';
            overlayDiv.setAttribute('tabindex', '-1');
            shadowRoot.appendChild(overlayDiv);

            
            // setTimeout workaround so blur will show up
            setTimeout(() => {
                // Blur the background
                overlayDiv.style.backdropFilter = 'blur(10px)';
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

        const form = document.createElement('form');
        screenDiv.appendChild(form);

        const frontDiv = document.createElement('div');
        frontDiv.innerHTML = flashcard.card_front;
        form.appendChild(frontDiv);

        const userInput = document.createElement('input');
        userInput.type = 'text';
        userInput.placeholder = 'Type answer here'
        form.appendChild(userInput);

        form.onsubmit = (event) => {
            event.preventDefault();
            userAnswer = userInput.value;

            const isCorrect = userAnswer.trim().toLowerCase() === flashcard.card_back.trim().toLowerCase();
            if (isCorrect) { ++count; }
            grade = isCorrect ? 3 : 1;

            screens["confirm"].activate();
        };

        userInput.focus();
    }

    // Shows review screen, really should be async because of strict ordering of review -> fetch -> display
    async function createConfirmScreen() {
        // Start by clearing the current content of overlayDiv
        screenDiv.innerHTML = '';

        // Show question
        const frontDiv = document.createElement('div');
        frontDiv.innerHTML = flashcard ? flashcard.card_front : "<code>&ltdeleted&gt</code>";
        screenDiv.appendChild(frontDiv);

        // Make diff div
        if (flashcard) {
            const diffMessage = `Your answer: ${userAnswer}<br>Correct answer: ${flashcard.card_back}`;
            const diffDiv = document.createElement('div');
            diffDiv.innerHTML = diffMessage;
            screenDiv.appendChild(diffDiv);
        }

        // Buttons container
        const buttonsDiv = document.createElement('div');
        buttonsDiv.id = "blobsey-flashcard-buttons-div";
        screenDiv.appendChild(buttonsDiv);

        if (grade) {
            try {
                await browser.runtime.sendMessage({
                    action: "reviewFlashcard",
                    card_id: flashcard.card_id,
                    grade: grade
                });    
            }
            catch (error) {
                console.error(error);
            }
            grade = null;
        }

        // Fetch next flashcard if haven't already
        if (!nextFlashcard) {
            try {
                nextFlashcard = await fetchNextFlashcard();
            }
            catch (error) {
                const messageDiv = document.createElement('div');
                screenDiv.appendChild(messageDiv);

                if (error.message === "No cards to review right now.") {
                    messageDiv.innerHTML = "No more cards to review for today! :)";
                }
                else {
                    messageDiv.innerHTML = error.message;
                    console.error(error);
                }
            }
        }

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
            const onClose = () => {
                setTimer(count);
                count = 0;
                flashcard = null;
                screens["flashcard"].deactivate();
                screens["confirm"].deactivate();
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
        const countNote = document.createElement('div');
        countNote.innerHTML = `Correct Answers: ${count}`;
        screenDiv.appendChild(countNote);

        setTimer(count); // Also set timer just in case page refresh
    }

    
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
        const form = document.createElement('form');
        const frontInput = document.createElement('textarea');
        frontInput.value = editFlashcard ? editFlashcard.card_front : '';
        frontInput.placeholder = 'Front of Flashcard';
        frontInput.id = 'edit-screen-textarea-front'; 
    
        // Make textarea expand when typing more
        frontInput.addEventListener('input', function() { adjustHeight(this) });
    
        form.appendChild(frontInput);
        screenDiv.appendChild(form);
        frontInput.focus();
        
        adjustHeight(frontInput); // Initially fit textarea to content
    
        const backInput = document.createElement('input');
        backInput.type = 'text';
        backInput.value = editFlashcard ? editFlashcard.card_back : '';
        backInput.placeholder = 'Back of Flashcard';
        backInput.id = 'edit-screen-input-back'; 
        form.appendChild(backInput);
    
        const buttonsDiv = document.createElement('div');
        buttonsDiv.id = 'blobsey-flashcard-buttons-div'
        form.appendChild(buttonsDiv);

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
        saveButton.type = 'submit';
        buttonsDiv.appendChild(saveButton);
    
        form.onsubmit = async (event) => {
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
        };
    
        // Trigger the transition animation
        requestAnimationFrame(() => {
            screenDiv.style.transition = 'opacity 0.1s ease, top 0.1s ease'; // Timings
            screenDiv.style.opacity = '1'; // Fade in
            screenDiv.style.top = '0px'; // Slightly slide up
            screenDiv.style.position = 'relative'; // Set position to relative for the top property to take effect
        });
    }

    function showToast(message, duration, undoFunction) {
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

    const loadingSvg = `<svg width="24" height="24" viewBox="0 0 24 24" stroke="white" fill="white" xmlns="http://www.w3.org/2000/svg"><style>.spinner_I8Q1{animation:spinner_qhi1 .75s linear infinite}.spinner_vrS7{animation-delay:-.375s}@keyframes spinner_qhi1{0%,100%{r:1.5px}50%{r:3px}}</style><circle class="spinner_I8Q1" cx="4" cy="12" r="1.5"/><circle class="spinner_I8Q1 spinner_vrS7" cx="12" cy="12" r="3"/><circle class="spinner_I8Q1" cx="20" cy="12" r="1.5"/><script xmlns="" id="bw-fido2-page-script"/>
    </svg>`;
    const blocksSvg = `<svg fill="white" width="48" height="48" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><style>.spinner_9y7u{animation:spinner_fUkk 2.4s linear infinite;animation-delay:-2.4s}.spinner_DF2s{animation-delay:-1.6s}.spinner_q27e{animation-delay:-.8s}@keyframes spinner_fUkk{8.33%{x:13px;y:1px}25%{x:13px;y:1px}33.3%{x:13px;y:13px}50%{x:13px;y:13px}58.33%{x:1px;y:13px}75%{x:1px;y:13px}83.33%{x:1px;y:1px}}</style><rect class="spinner_9y7u" x="1" y="1" rx="1" width="10" height="10"/><rect class="spinner_9y7u spinner_DF2s" x="1" y="1" rx="1" width="10" height="10"/><rect class="spinner_9y7u spinner_q27e" x="1" y="1" rx="1" width="10" height="10"/></svg>`;
    const catSvg = `
    <div id = "blobsey-flashcard-cat">
        <svg height="200px" width="200px" version="1.1" id="_x32_" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" viewBox="0 0 512 512" xml:space="preserve" fill="#ffffff" stroke="#ffffff"><g id="SVGRepo_bgCarrier" stroke-width="0"></g><g id="SVGRepo_tracerCarrier" stroke-linecap="round" stroke-linejoin="round"></g><g id="SVGRepo_iconCarrier"> <style type="text/css"> .st0{fill:#ffffff;} </style> <g> <polygon class="st0" points="96.388,197.393 97.009,203.262 159.896,196.556 159.268,190.688 "></polygon> <path class="st0" d="M155.486,111.05c-8.683,0-15.734,7.052-15.734,15.727c0,8.69,7.052,15.734,15.734,15.734 s15.72-7.044,15.72-15.734C171.206,118.101,164.169,111.05,155.486,111.05z"></path> <polygon class="st0" points="97.515,171.836 161.953,176.924 162.408,171.042 97.969,165.968 "></polygon> <polygon class="st0" points="272.209,42.238 258.943,59.935 281.057,64.352 "></polygon> <polygon class="st0" points="143.93,42.238 135.082,64.352 157.203,59.935 "></polygon> <path class="st0" d="M276.395,126.776c0-8.675-7.044-15.727-15.734-15.727c-8.682,0-15.728,7.052-15.728,15.727 c0,8.69,7.045,15.734,15.728,15.734C269.351,142.511,276.395,135.466,276.395,126.776z"></path> <polygon class="st0" points="319.758,197.393 256.879,190.688 256.25,196.556 319.137,203.262 "></polygon> <polygon class="st0" points="318.163,165.968 253.745,171.042 254.207,176.924 318.625,171.836 "></polygon> <path class="st0" d="M242.4,203.637c-4.475,1.076-8.257,1.523-11.404,1.523c-4.171,0-7.196-0.78-9.455-1.913 c-3.349-1.71-5.298-4.273-6.64-7.578c-1.299-3.27-1.776-7.196-1.776-10.732c0-2.216,0.195-4.165,0.39-5.788l9.382-9.376 c1.732-1.718,2.245-4.323,1.314-6.582c-0.938-2.252-3.14-3.717-5.572-3.717h-21.132c-2.498,0-4.736,1.53-5.623,3.868 c-0.902,2.331-0.267,4.958,1.581,6.64l9.022,8.17c0.259,1.74,0.519,4.107,0.519,6.799c0.022,4.721-0.866,10.098-3.335,13.779 c-1.256,1.862-2.814,3.37-5.081,4.518c-2.252,1.133-5.269,1.913-9.44,1.913c-3.147,0-6.929-0.447-11.404-1.53 c-2.425-0.57-4.879,0.931-5.456,3.356c-0.57,2.425,0.931,4.879,3.363,5.464c5.024,1.191,9.484,1.754,13.497,1.761 c5.298,0,9.802-1.018,13.526-2.887c4.359-2.187,7.405-5.529,9.448-9.16l0.801,1.56c1.992,3.009,4.836,5.731,8.545,7.6 c3.724,1.869,8.236,2.887,13.526,2.887c4.006,0,8.474-0.57,13.505-1.768c2.432-0.592,3.926-3.032,3.341-5.457 C247.265,204.561,244.825,203.059,242.4,203.637z"></path> <path class="st0" d="M435.895,246.307c0.657-0.678,1.624-1.306,2.31-1.646l0.404-0.188l21.436-7.145l-2.743-5.492 c7.716-9.448,10.978-22.324,7.651-34.861c-4.54-17.178-20.116-29.181-37.878-29.181c-3.385,0-6.756,0.44-10.047,1.299l-0.289,0.086 l-0.281,0.087c-11.043,3.211-21.776,9.116-31.159,17.091c-8.863,7.607-15.886,16.701-20.952,27.08 c-5.94,12.118-9.079,26.301-9.058,40.974c0.008,18.527,4.604,38.087,14.053,59.747c4.503,10.372,6.799,21.66,6.799,33.583 c0.043,16.037-4.338,32.572-11.924,45.629c-2.367-7.744-5.55-15.128-9.491-22.021c-18.513-32.414-41.891-82.374-53.33-107.354 c27.917-11.57,47.751-29.808,59.105-54.398c32.226-69.844-9.982-128.408-40.014-152.644C293.385,0.007,276.727,0.007,269.509,0 h-0.007c-1.314,0-2.627,0.109-3.919,0.325c-11.7,1.956-26.561,13.944-44.23,35.684H208.91h-12.457 c-17.668-21.739-32.522-33.728-44.23-35.684C150.939,0.109,149.625,0,148.304,0h-0.086c-7.261,0-23.898,0.231-50.891,56.954 C67.295,81.191,25.093,139.769,57.32,209.598c10.949,23.724,29.801,41.552,56.188,53.179 c-8.834,21.747-30.775,74.226-50.422,108.581c-19.018,33.28-19.538,78.52-1.256,110.01C73.119,500.841,90.527,512,109.582,512 h93.901h10.87h93.9c14.645,0,28.148-6.46,38.83-18.404c14.039-1.56,27.897-6.359,40.563-14.103 c20.202-12.372,37.236-31.7,49.289-55.915c11.526-23.305,17.611-49.512,17.625-75.82c0.008-22.764-4.482-44.605-13.338-64.93 c-6.214-14.255-7.514-23.328-7.506-28.43c0.007-4.272,0.816-5.961,1.162-6.684L435.895,246.307z M432.402,225.881l-0.419,0.13 c-0.491,0.188-1.371,0.52-2.461,1.075c-2.201,1.083-5.153,2.944-7.715,5.594c-1.711,1.768-3.291,3.876-4.598,6.546 c-1.718,3.573-3.082,8.206-3.103,15.157c-0.008,8.38,2.166,20.267,9.144,36.282c8.127,18.651,11.714,38.167,11.707,57.077 c-0.015,24.041-5.709,47.145-15.575,67.109c-9.917,19.92-23.999,36.918-41.964,47.925c-11.916,7.275-25.738,11.765-40.353,11.779 c-7.232,10.87-17.135,17.842-28.813,17.842c-27.21,0-73.084,0-93.9,0c0,0-4.128,0-10.87,0c-20.823,0-66.691,0-93.901,0 c-36.016,0-55.662-65.478-29.469-111.317c26.192-45.838,55.654-121.147,55.654-121.147l2.729-8.92 c-25.76-7.55-50.61-21.97-63.37-49.635c-35.951-77.885,37.928-131.792,37.928-131.792s23.075-49.982,35.25-49.982l0.7,0.065 c11.981,1.992,37.936,35.943,37.936,35.943h21.97h21.956c0,0,25.969-33.951,37.95-35.943l0.692-0.065 c12.184,0.007,35.244,49.982,35.244,49.982s73.893,53.908,37.943,131.792c-13.453,29.159-40.331,43.572-67.549,50.776l1.408,4.504 c0,0,34.969,78.585,61.154,124.423c8.286,14.493,11.974,30.935,12.024,46.662l-0.916,5.406c2.722-0.975,5.442-2.187,8.207-3.862 c6.726-4.085,13.41-10.386,19.234-18.491c11.707-16.182,19.552-39.394,19.488-63.053c0-13.988-2.642-28.12-8.438-41.407 c-8.596-19.726-12.399-36.86-12.407-51.952c-0.022-12.429,2.685-23.407,7.066-32.357c4.374-8.957,10.278-15.792,16.03-20.729 c11.613-9.873,22.331-12.731,24.049-13.237c1.682-0.447,3.364-0.664,5.031-0.664c8.675,0,16.614,5.802,18.932,14.601 c2.743,10.343-3.349,20.931-13.62,23.854L432.402,225.881z"></path> </g> </g></svg>
        No flashcards found
    </div>`;


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
            this.display.innerHTML = loadingSvg;
            this.element.appendChild(this.display);

            this.optionsContainer = document.createElement('div');
            this.optionsContainer.className = 'blobsey-flashcard-dropdown-options';
            this.element.appendChild(this.optionsContainer);

            this.options = {}
            this.selectedOption = null;
            this.isDisabled = false;
            this.isOpen = false;

            this.element.addEventListener('click', (event) => {
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
                this.display.innerHTML = loadingSvg;
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
                if (this.selectedOption && this.options[this.selectedOption]) {
                    this.options[this.selectedOption].element.classList.remove('selected');
                }
                this.selectedOption = key;
                this.options[key].element.classList.add('selected');
            }
        }

        setDisplayText(displayText) {
            if (displayText === "Select a deck...")
                this.display.classList.add("placeholder");
            else
                this.display.classList.remove("placeholder");
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
        static allMenus = [];
        constructor(displayDiv) {
            this.element = displayDiv;
            this.elementCopy = this.element.innerHTML;

            this.isDisabled = false;
            this.isOpen = false;
    
            this.menu = document.createElement('div');
            this.menu.className = 'blobsey-flashcard-context-menu-container';
            screenDiv.appendChild(this.menu);
            
            this.element.addEventListener('click', (event) => {
                if (this.isOpen) {
                    this.close();
                }
                else {
                    this.open();
                }
            });

            // Close when click off
            shadowRoot.addEventListener('click', (event) => {
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
            
            ContextMenuElement.allMenus.push(this)
        }

        disable() {
            this.element.innerHTML = loadingSvg;
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

        static closeAll() {
            ContextMenuElement.allMenus.forEach((menu) => {
                menu.close();
            });
        }

        addOption(element) {
            this.menu.appendChild(element);
        }
    }

    let searchText = '';
    let tableContainer;
    let scrollContainer;
    let deckSelect;
    let userData;
    let selectedOption = null;
    let flashcards;
    let setActiveDeckButton;
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

        const deckThreeDotsIcon = document.createElement('span');
        deckThreeDotsIcon.textContent = '⋮';

        deckThreeDots = new ContextMenuElement(deckThreeDotsIcon);
        deckThreeDots.element.id = 'blobsey-flashcard-deck-threedots';
        fullscreenDiv.appendChild(deckThreeDots.element);

        const addFlashcardOption = document.createElement('div');
        addFlashcardOption.textContent = 'Add flashcard';
        addFlashcardOption.addEventListener('click', (event) => {
            editFlashcard = null;
            screens['addEdit'].activate();
        });
        deckThreeDots.addOption(addFlashcardOption);

        setActiveDeckButton = document.createElement('button');
        setActiveDeckButton.id = 'blobsey-flashcard-set-active-deck-button';
        setActiveDeckButton.disabled = true;
        setActiveDeckButton.addEventListener('click', async () => {
            setActiveDeckButton.innerHTML = loadingSvg;
            const selectedDeck = deckSelect.selectedOption;
            try {
                await browser.runtime.sendMessage({
                    action: "setUserData",
                    userData: { deck: selectedDeck }
                });
                userData.deck = selectedDeck;
                await updateDeckList();
                updateSetActiveDeckButtonState();
            } catch (error) {
                console.error("Error while setting active deck: ", error);
            }
        });
        deckThreeDots.addOption(setActiveDeckButton);

    
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
        await loadDeck(selectedOption);
    }

    function updateSetActiveDeckButtonState() {
        const isActiveDeck = deckSelect.selectedOption === userData.deck;
        setActiveDeckButton.disabled = isActiveDeck;
        setActiveDeckButton.textContent = isActiveDeck ? 'Active Deck' : 'Set Active Deck';
    }
    
    async function updateDeckList() {
        try {
            // Fetch deck list
            const { result, data } = await browser.runtime.sendMessage({ action: "getUserData" });
            if (result !== "success") {
                throw new Error("Error fetching user data: ", response.result);
            }
            userData = data;
            selectedOption = selectedOption || userData.deck;

            deckSelect.clearOptions(); // Clear existing options
        
            // Populate deckSelect
            userData.decks.forEach(deck => {
                const optionDiv = document.createElement('div');

                // Main button
                const optionText = document.createElement('div');
                optionText.className = 'blobsey-flashcard-dropdown-option-text';
                optionText.textContent = (deck === userData.deck) ? `${deck} (Active)` : deck;
                optionText.addEventListener('click', async (event) => {
                    try {
                        deckSelect.selectOption(deck);
                        deckSelect.setDisplayText(optionText.textContent)
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
                            
                            await updateDeckList();
                            showToast(`Deck "${deck}" renamed to "${newName}"`, 10000);
                        } 
                        catch (error) {
                            newName = deck;
                            showToast(error.message, 10000);
                            console.error("Error while renaming deck: ", error);
                        } 
                        finally {
                            if (isRenamingSelectedDeck) {
                                deckSelect.selectOption(newName);
                                selectedOption = newName;
                                deckSelect.setDisplayText((selectedOption === userData.deck) ? `${selectedOption} (Active)` : selectedOption);
                                await loadDeck(newName);
                            }

                            // In case displayed flashcard is from renamed deck
                            if (isRenamingActiveDeck) {
                                if (screens["flashcard"].active) {
                                    flashcard = null;
                                    showFlashcard();
                                }
                            }
                            deckSelect.enable();
                            deckSelect.open();
                            deckThreeDots.enable();
                        }
                    }
                });
                threeDots.addOption(renameOption);

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
                            await updateDeckList();
                            if (isDeletingSelectedDeck) {
                                deckSelect.setDisplayText("Select a deck...");
                                selectedOption = null;
                                await loadDeck(deckSelect.selectedOption);
                                flashcard = null; 
                            }
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
                    await updateDeckList();
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
                            let counter = 1;
                            let duplicateDeckName = null;
                            while (userData.decks.includes(duplicateDeckName)) {
                                counter++;
                                duplicateDeckName = `${deckName} ${counter}`;
                            }
                            
                            const response = await browser.runtime.sendMessage({
                                action: "uploadDeck",
                                file: file,
                                deck: duplicateDeckName || deckName
                            });
            
                            if (response.result !== "success") {
                                throw new Error(response.message);
                            } 

                            showToast(response.message, 10000);
                            await updateDeckList();
                        } 
                        catch (error) {
                            showToast("An error occurred while importing the deck.", 10000);
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

            // Try to select the already selected option, can also be null if deleted
            deckSelect.selectOption(selectedOption);
            if (selectedOption) {
                deckSelect.setDisplayText((selectedOption === userData.deck) ? `${selectedOption} (Active)` : selectedOption);
            }
            else {
                deckSelect.setDisplayText('Select a deck...');
            }
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
            loadingDiv.innerHTML = blocksSvg;
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
            tableContainer.innerHTML = error;
            console.error("Error while loading deck: ", error);
        }
        finally {
            updateFlashcardList();
            updateSetActiveDeckButtonState();
        }
    }
    
    function updateFlashcardList() {
        if (!flashcards) {
            return;
        }
    
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
            tableContainer.innerHTML = catSvg;
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
