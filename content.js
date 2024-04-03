// content.js
// Handles UI/UX, application logic
(async function() {
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
            screenToLoad = urlParams.get('screenToLoad') || 'list';
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
    async function submitFlashcardAdd(cardFront, cardBack) {
        try {
          const response = await browser.runtime.sendMessage({
            action: "addFlashcard",
            card_front: cardFront,
            card_back: cardBack
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
        "edit": new Screen(createEditScreen),
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
                screens["edit"].activate();
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

    function createEditScreen() {
        screenDiv.innerHTML = ''; // Clear current content

        screenDiv.style.opacity = '0'; // Fade in
        screenDiv.style.top = '10px'; // Slightly slide up
        screenDiv.style.position = 'relative'; // Set position to relative for the top property to take effect
    
        // Front textarea input
        const form = document.createElement('form');
        const frontInput = document.createElement('textarea');
        frontInput.value = editFlashcard.card_front;
        frontInput.placeholder = 'Front';
        frontInput.id = 'edit-screen-textarea-front'; 
    
        // Make textarea expand when typing more
        frontInput.addEventListener('input', function() { adjustHeight(this) });
    
        form.appendChild(frontInput);
        screenDiv.appendChild(form);
        frontInput.focus();
        
        adjustHeight(frontInput); // Initially fit textarea to content
    
        const backInput = document.createElement('input');
        backInput.type = 'text';
        backInput.value = editFlashcard.card_back;
        backInput.placeholder = 'Back';
        backInput.id = 'edit-screen-input-back'; 
        form.appendChild(backInput);
    
        const buttonsDiv = document.createElement('div');
        buttonsDiv.id = 'blobsey-flashcard-buttons-div'
        form.appendChild(buttonsDiv);

        // Save initial values so we can detect when editor is "dirty"
        const initialFrontValue = frontInput.value;
        const initialBackValue = backInput.value;
    
        // Function to close edit screen to pass in to x button and cancel button
        const onClose = (() => {
            if ((frontInput.value === initialFrontValue && backInput.value === initialBackValue) || confirm("Really close? (Unsaved edits will be lost)")) {
                screenDiv.style.transition = ''; // Clean up animations on close
                screens["edit"].deactivate();
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
        const deleteButton = document.createElement('button');
        deleteButton.textContent = 'Delete';
        deleteButton.type = 'button';
        deleteButton.addEventListener('click', function() {
          if (confirm("Are you sure you want to delete this flashcard?")) {
            submitFlashcardDelete(editFlashcard.card_id)
              .then(() => {
                if (nextFlashcard && nextFlashcard.card_id === editFlashcard.card_id)
                    nextFlashcard = null;
                if (flashcard && flashcard.card_id === editFlashcard.card_id)
                    flashcard = null;
                editFlashcard = null;
                screens["edit"].deactivate();
                showToast('Flashcard deleted. ', 10000); // TODO: add undo function (client side ??)
              })
              .catch(error => {
                console.error(error.message);
              });
          }
        });
        buttonsDiv.appendChild(deleteButton);
    
        // Save button
        const saveButton = document.createElement('button');
        saveButton.textContent = 'Save';
        saveButton.type = 'submit';
        buttonsDiv.appendChild(saveButton);
    
        form.onsubmit = (event) => {
            event.preventDefault();
            submitFlashcardEdit(editFlashcard.card_id, frontInput.value, backInput.value).then(response => {
                flashcard = response;
            })
            .catch(error => {
                console.error(error.message);
            })
            .finally(() => {
                screens["edit"].deactivate();
            });
        };
    
        // Trigger the transition animation
        setTimeout(() => {
            screenDiv.style.opacity = '1'; // Fade in
            screenDiv.style.top = '0px'; // Slightly slide up
            screenDiv.style.position = 'relative'; // Set position to relative for the top property to take effect
            screenDiv.style.transition = 'opacity 0.1s ease, top 0.1s ease'; // Timings
        }, 50);
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
        <svg xmlns="http://www.w3.org/2000/svg" xml:space="preserve" width="200" height="200" fill="#fff" viewBox="0 0 512 512">
            <circle cx="93.001" cy="122.066" r="11.429"/>
            <path d="M199.706 166.954c-2.863-5.06-9.291-6.825-14.339-3.95a6.753 6.753 0 0 1-4.78.736 6.854 6.854 0 0 1-5.095-4.569l-.012.012c-1.017-3.085-3.412-5.656-6.72-6.743-5.528-1.8-11.465 1.215-13.264 6.731a6.87 6.87 0 0 1-5.107 4.569c-2.092.444-3.751-.164-4.78-.736-5.049-2.875-11.464-1.11-14.339 3.95-2.863 5.049-1.099 11.465 3.95 14.339a27.86 27.86 0 0 0 19.493 3.039 27.788 27.788 0 0 0 10.763-4.838 27.931 27.931 0 0 0 10.798 4.838 27.843 27.843 0 0 0 19.481-3.039c5.05-2.874 6.826-9.29 3.951-14.339z"/>
            <circle cx="237.985" cy="122.066" r="11.429"/>
            <path d="M423.791 344.933a11.612 11.612 0 0 0-5.745-.039c-6.264 1.543-10.097 7.877-8.555 14.141 4.85 19.657 1.858 40.12-8.414 57.603-3.272 5.563-1.414 12.727 4.16 15.987a11.545 11.545 0 0 0 5.902 1.613c4.008 0 7.912-2.057 10.086-5.761a101.69 101.69 0 0 0 8.246-17.732 99.716 99.716 0 0 0 5.549-28.31 99.838 99.838 0 0 0-.355-14.506 100.736 100.736 0 0 0-1.917-12.076c-.177-.802-.365-1.603-.562-2.403a11.624 11.624 0 0 0-1.598-3.629 11.643 11.643 0 0 0-1.104-1.441 11.763 11.763 0 0 0-.799-.796 11.81 11.81 0 0 0-1.425-1.087 11.646 11.646 0 0 0-3.469-1.564z"/>
            <path d="M490.036 373.97c.012-.222.035-.456.035-.69V145.848c0-11.862-4.616-23.011-12.995-31.367-8.391-8.368-19.517-12.984-31.355-12.984-24.46 0-44.351 19.891-44.351 44.351v88.432l-101.264-63.96c5.843-16.455 8.952-33.739 8.952-50.965V24.273C309.058 10.892 298.166 0 284.785 0a24.18 24.18 0 0 0-16.84 6.801L226.54 48.207c-18.605-10.436-39.512-15.917-61.051-15.917-21.538 0-42.457 5.481-61.051 15.917L63.032 6.802A24.176 24.176 0 0 0 46.192 0C32.811 0 21.919 10.892 21.919 24.273v95.082c0 38.133 15.204 76.617 41.698 105.588 10.506 11.488 22.251 21.001 34.861 28.398-.619 7.573-.83 15.263-.619 22.952.923 34.452 10.202 68.331 26.821 98.296v66.368h-.444c-19.587 0-35.527 15.929-35.527 35.515v13.077c0 12.376 10.074 22.45 22.438 22.45h60.49c15.228 0 28.223-9.77 33.05-23.373h12.224v.257c0 12.738 10.366 23.116 23.104 23.116h133.648c34.522 0 67.315-16.653 87.696-44.526.012 0 .012-.012.012-.012a105.034 105.034 0 0 0 6.159-9.396c.035-.047.058-.093.094-.14.07-.128.152-.257.234-.397 15.738-26.235 22.867-55.113 22.178-83.558zM80.854 209.166a136.366 136.366 0 0 1-6.918-8.227l8.449-.713c6.428-.549 11.207-6.206 10.658-12.633-.538-6.439-6.194-11.207-12.633-10.658l-20.603 1.741a136.292 136.292 0 0 1-5.668-12.762l25.734 3.412c.514.07 1.028.093 1.543.093 5.773 0 10.798-4.266 11.57-10.144.853-6.404-3.646-12.283-10.05-13.124l-35.656-4.733c-1.297-7.304-1.987-14.69-1.987-22.064V24.273c0-.491.409-.9.9-.9.082 0 .304 0 .538.175l47.693 47.705a11.698 11.698 0 0 0 14.76 1.449c16.688-11.149 36.158-17.039 56.306-17.039 20.136 0 39.617 5.89 56.306 17.039a11.698 11.698 0 0 0 14.76-1.449l47.693-47.705c.234-.175.456-.175.538-.175.491 0 .9.409.9.9v95.082c0 7.374-.678 14.76-1.987 22.064l-35.667 4.733c-6.393.841-10.892 6.72-10.05 13.124.783 5.878 5.797 10.144 11.57 10.144a13.9 13.9 0 0 0 1.554-.094l25.734-3.412a133.345 133.345 0 0 1-5.668 12.762l-20.615-1.741c-6.439-.549-12.084 4.219-12.633 10.658-.538 6.428 4.231 12.084 10.658 12.633l8.461.713a136.366 136.366 0 0 1-6.918 8.227c-23.174 25.325-53.232 39.267-84.634 39.267s-61.463-13.942-84.638-39.267zM447.871 445.41l-5.539 8.484c-16.022 21.749-41.674 34.732-68.67 34.732h-133.38V475c0-7.514 6.1-13.627 13.615-13.627h34.581c4.125 0 7.935-2.174 10.05-5.726a11.683 11.683 0 0 0 .21-11.558c-6.766-12.411-10.343-26.505-10.343-40.739 0-47.027 38.25-85.277 85.265-85.277 6.451 0 11.687-5.236 11.687-11.687 0-6.463-5.236-11.687-11.687-11.687-59.905 0-108.638 48.733-108.638 108.65 0 11.803 1.928 23.525 5.656 34.651h-16.782c-17.027 0-31.39 11.57-35.679 27.253h-11.523v-74.712c0-6.463-5.236-11.687-11.687-11.687a11.676 11.676 0 0 0-11.687 11.687v86.399c0 6.439-5.247 11.687-11.687 11.687h-59.555v-12.154c0-6.696 5.458-12.142 12.154-12.142h12.131c6.451 0 11.687-5.236 11.687-11.687v-77.949a11.663 11.663 0 0 0-1.274-8.461c-15.87-27.405-24.705-58.725-25.547-90.571-.105-3.88-.082-7.76.047-11.616 14.164 5.107 29.041 7.76 44.21 7.76 38.051 0 74.221-16.642 101.872-46.863a159.73 159.73 0 0 0 23.233-32.991l110.8 69.979c63.659 40.177 84.04 120.745 46.48 183.478zm18.827-149.997c-10.6-17.284-24.67-32.898-41.955-45.765v-103.8c0-11.57 9.408-20.977 20.977-20.977 5.598 0 10.868 2.185 14.842 6.147 3.95 3.95 6.135 9.221 6.135 14.83v149.565z"/>
            <circle cx="93.001" cy="122.066" r="11.429"/>
            <path d="M199.706 166.954c-2.863-5.06-9.291-6.825-14.339-3.95a6.753 6.753 0 0 1-4.78.736 6.856 6.856 0 0 1-5.095-4.569l-.012.012c-1.017-3.085-3.412-5.656-6.72-6.743-5.528-1.8-11.465 1.215-13.264 6.732a6.87 6.87 0 0 1-5.107 4.569c-2.092.444-3.751-.164-4.78-.736-5.049-2.875-11.464-1.11-14.339 3.95-2.863 5.049-1.099 11.465 3.95 14.339a27.86 27.86 0 0 0 19.493 3.039 27.788 27.788 0 0 0 10.763-4.838 27.931 27.931 0 0 0 10.798 4.838 27.843 27.843 0 0 0 19.481-3.039c5.05-2.875 6.826-9.291 3.951-14.34z"/>
            <circle cx="237.985" cy="122.066" r="11.429"/>
            <path d="M432.187 353.448c-1.543-6.264-7.877-10.097-14.141-8.555-6.264 1.543-10.097 7.877-8.555 14.141 4.85 19.657 1.858 40.12-8.414 57.603-3.272 5.563-1.414 12.727 4.16 15.987a11.545 11.545 0 0 0 5.902 1.613c4.008 0 7.912-2.057 10.086-5.761 13.381-22.777 17.273-49.422 10.962-75.028z"/>
            <circle cx="93.001" cy="122.066" r="11.429"/>
            <circle cx="237.985" cy="122.066" r="11.429"/>
            <path d="M199.706 166.954c-2.863-5.06-9.291-6.825-14.339-3.95a6.753 6.753 0 0 1-4.78.736 6.856 6.856 0 0 1-5.095-4.569l-.012.012c-1.017-3.085-3.412-5.656-6.72-6.743-5.528-1.8-11.465 1.215-13.264 6.732a6.87 6.87 0 0 1-5.107 4.569c-2.092.444-3.751-.164-4.78-.736-5.049-2.875-11.464-1.11-14.339 3.95-2.863 5.049-1.099 11.465 3.95 14.339a27.86 27.86 0 0 0 19.493 3.039 27.788 27.788 0 0 0 10.763-4.838 27.931 27.931 0 0 0 10.798 4.838 27.843 27.843 0 0 0 19.481-3.039c5.05-2.875 6.826-9.291 3.951-14.34zM432.187 353.448c-1.543-6.264-7.877-10.097-14.141-8.555-6.264 1.543-10.097 7.877-8.555 14.141 4.85 19.657 1.858 40.12-8.414 57.603-3.272 5.563-1.414 12.727 4.16 15.987a11.545 11.545 0 0 0 5.902 1.613c4.008 0 7.912-2.057 10.086-5.761 13.381-22.777 17.273-49.422 10.962-75.028z"/>
        </svg>
        No flashcards found
    </div>`;

    /* List Screen
    - searchText, tableContainer, deckSelect, userData, flashcards, setActiveDeckButton global vars
    - createListScreen() should create searchBar, await updateDeckList(), then loadDeck(userData["deck"]).
      Also create the setActiveDeckButton, set its status on deck load, and when pressed
    - searchbar calls updateFlashcardList() on every input, but this does nothing if !flashcards
    - updateFlashcardList() takes current searchtext and then updates table to reflect it
    - updateDeckList() fetches decklist and populates the deckSelect, annotating current deck
        * All normal drop-down options loadDeck(deck)
        * "Create deck..." option creates a deck named "Untitled Deck 1" (or "Untitled 
          deck 2", "Untitled Deck 3", etc.) switches drop-down to that deck, then loads it
    - loadDeck(deck) loads the deck specified by deck by awaiting "listFlashcards" message, then
      it calls updateFlashcardList() */

    let searchText = '';
    let tableContainer;
    let deckSelect;
    let userData;
    let flashcards;
    let setActiveDeckButton;
    
    async function createListScreen() {
        screenDiv.innerHTML = ''; // Clear current content
        const fullscreenDiv = document.createElement('div');
        fullscreenDiv.id = 'blobsey-flashcard-fullscreen-div';
        screenDiv.appendChild(fullscreenDiv);
    
        // Create a drop-down menu for deck selection
        deckSelect = document.createElement('select');
        deckSelect.id = 'blobsey-flashcard-deck-select';
        fullscreenDiv.appendChild(deckSelect);

        setActiveDeckButton = document.createElement('button');
        setActiveDeckButton.id = 'blobsey-flashcard-set-active-deck-button';
        setActiveDeckButton.disabled = true;
        setActiveDeckButton.textContent = "Loading..."
        setActiveDeckButton.addEventListener('click', async () => {
            setActiveDeckButton.innerHTML = loadingSvg;
            const selectedDeck = deckSelect.value;
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
        fullscreenDiv.appendChild(setActiveDeckButton);
    
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
        searchBar.focus();
    
        createCloseButton();
    
        // Create a container for the table
        const container = document.createElement('div');
        container.id = 'blobsey-flashcard-list-container';
        fullscreenDiv.appendChild(container);
    
        // tableContainer to hold table
        tableContainer = document.createElement('div');
        tableContainer.id = 'blobsey-flashcard-list-table-container';
        loadingDiv = document.createElement('div'); // Loading screen
        loadingDiv.id = "blobsey-flashcard-loading-div";
        loadingDiv.innerHTML = blocksSvg;
        tableContainer.appendChild(loadingDiv);
        container.appendChild(tableContainer);
    
        await updateDeckList();
        deckSelect.value = userData.deck;
        await loadDeck(userData.deck);
    }

    function updateSetActiveDeckButtonState() {
        const isActiveDeck = deckSelect.value === userData.deck;
        setActiveDeckButton.disabled = isActiveDeck;
        setActiveDeckButton.textContent = isActiveDeck ? 'Active Deck' : 'Set Active Deck';
    }
    
    async function updateDeckList() {
        try {
            const preservedOption = deckSelect.value || null; // Preserve previous selected value
            deckSelect.innerHTML = ''; // Clear existing options

            // Fetch deck list
            const { result, data } = await browser.runtime.sendMessage({ action: "getUserData" });
            if (result !== "success") {
                throw new Error("Error fetching user data: ", response.result);
            }
            userData = data;
        
            // Populate deckSelect
            userData.decks.forEach(deck => {
                const option = document.createElement('option');
                option.value = deck;
                option.textContent = deck;
                if (userData.deck === deck) 
                    option.textContent += " (Active)"
                
                deckSelect.appendChild(option);
            });

            deckSelect.value = preservedOption;
        
            // Add "Create Deck" option
            const createDeckOption = document.createElement('option');
            createDeckOption.value = 'create';
            createDeckOption.textContent = 'Create Deck...';
            deckSelect.appendChild(createDeckOption);
        
            deckSelect.addEventListener('change', async () => {
                if (deckSelect.value === 'create') {
                    // Find a unique deck name
                    let counter = 1;
                    let newDeckName;  
                    do {
                        newDeckName = `Untitled Deck ${counter}`;
                        counter++;
                    } while (userData.decks.includes(newDeckName));
                
                    // Create deck with new name
                    try {
                        const updatedDecks = [...userData.decks, newDeckName];
                        await browser.runtime.sendMessage({
                            action: "setUserData",
                            userData: { decks: updatedDecks }
                        });
                        userData.decks = updatedDecks;
                        await updateDeckList();
                        deckSelect.value = newDeckName;
                        loadDeck(newDeckName);
                    } catch (error) {
                        console.error("Error while creating a new deck: ", error);
                    }
                } else {
                    await loadDeck(deckSelect.value);
                }
            });
            
        } catch (error) {
            console.error("Error while fetching user data: ", error);
        }
    }
    
    async function loadDeck(deck) {
        tableContainer.innerHTML = '';
        flashcards = null; // Should be null just in case user enters something into search bar while loading

        // Loading screen
        loadingDiv = document.createElement('div');
        loadingDiv.id = "blobsey-flashcard-loading-div";
        loadingDiv.innerHTML = blocksSvg;
        tableContainer.appendChild(loadingDiv); 

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
                frontCell.textContent = truncateText(card.card_front, 50);
                const backCell = document.createElement('td');
                backCell.textContent = card.card_back;
                row.appendChild(frontCell);
                row.appendChild(backCell);
                tbody.appendChild(row);

                // Add click event listener to each row
                row.addEventListener('click', function() {
                    editFlashcard = card; // Update the global variable with the selected flashcard
                    screens["edit"].activate(); // Switch to the edit screen
                });
            });
        }
    }
    

    // Helper function to cut off flashcard text that is too long
    function truncateText(text, maxLength) {
        const ellipsis = '...';
        const maxTextLength = maxLength - ellipsis.length; // Adjust for the ellipsis
    
        if (text.length > maxLength) {
            return text.slice(0, maxTextLength) + ellipsis;
        }
        return text;
    }
    
})();
