// content.js
// Handles UI/UX, application logic
(async function() {

    // Create Shadow DOM and load CSS from file
    const root = document.createElement('div');
    document.body.appendChild(root);
    const shadowRoot = root.attachShadow({ mode: 'open' });
    const cssFileUrl = browser.runtime.getURL('styles.css'); 
    const cssResponse = await fetch(cssFileUrl);
    const cssText = await cssResponse.text();
  
    const styleEl = document.createElement('style');
    styleEl.textContent = cssText;
    shadowRoot.appendChild(styleEl);


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
            console.log("Flashcard updated successfully");
            return response.flashcard; // Return the updated flashcard for further processing
        } else {
            // Handle failure
            console.error("Failed to update flashcard:", response.message);
            throw new Error(response.message); // Propagate the error to be handled by the caller
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
        const mediaElements = shadowRoot.querySelectorAll("video, audio");
        mediaElements.forEach(media => {
            if (!media.paused) {
                media.pause();
            }
        });
    }


    // Listen for messages from the background script to show the overlay
    browser.runtime.onMessage.addListener((request, sender, sendResponse) => {
        switch (request.action) {
            case "showFlashcard":
                showFlashcard();
                break;
            case "showExpandedPopupScreen":
                showExpandedPopupScreen();
                break;
        }
    });

    // On page load, check if we should show the overlay
    browser.storage.local.get("fetchNextFlashcardTime").then(data => {
        const currentTime = Date.now();

        // Check if 'fetchNextFlashcardTime' exists
        if (data.hasOwnProperty('fetchNextFlashcardTime')) {
            // 'fetchNextFlashcardTime' exists, check if the current time is past this timestamp
            if (currentTime >= data.fetchNextFlashcardTime) {
                showFlashcard(); // Time has passed, show the overlay
            } // If time has not passed, do nothing and wait for the next alarm
        } else {
            showFlashcard(); // 'fetchNextFlashcardTime' probably got deleted, show anyways
        }
    })
    .catch(error => {
        console.error("Error accessing storage in content script:", error);
    });

    // Tries to show a flashcard, if there are none then sets a timer 1min from now to check again
    function showFlashcard() {
        fetchNextFlashcard().then(fetchedCard => {
            pauseMediaPlayback();
            flashcard = fetchedCard;
            screens["flashcard"].activate();
        })
        .catch(error => {
            if (error.message !== "No cards to review right now.")
                console.error(error.message);
            setTimer(1);
        });
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
        // Draw the highest priority screen
        for (const label in screens) {
            if (screens[label].active) {
                if (currentScreen === label) {
                    return;
                }
                else {
                    currentScreen = label;
                    createOverlayIfNotExists();
                    screens[label].render();
                    return;
                }
            }
        }

        // If no screens active, remove overlay
        if (overlayDiv) {
            overlayDiv.addEventListener('transitionend', function handler(e) {
                // Specifically check for the opacity transition to ensure correct removal
                if (e.propertyName === 'opacity') {
                    overlayDiv.remove();
                    overlayDiv.removeEventListener('transitionend', handler); // Clean up
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

    // Create overlay which darkens/blurs screen, prepare screenDiv for rendering
    function createOverlayIfNotExists() {
        // Get the root div of the overlay and wipe it out
        overlayDiv = shadowRoot.getElementById('blobsey-flashcard-overlay');
        if (!overlayDiv) {
            originalOverflowState = document.documentElement.style.overflow;
            document.documentElement.style.overflow = 'hidden';
            overlayDiv = document.createElement('div');
            overlayDiv.id = 'blobsey-flashcard-overlay';
            shadowRoot.appendChild(overlayDiv)
            
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
    
    // Shows a flashcard and an input box for answering
    function createFlashcardScreen() {
        screenDiv.innerHTML = '';

        const form = document.createElement('form');
        screenDiv.appendChild(form);

        const frontDiv = document.createElement('div');
        frontDiv.innerHTML = flashcard.card_front;
        form.appendChild(frontDiv);

        const userInput = document.createElement('input');
        userInput.type = 'text';
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
        frontDiv.innerHTML = flashcard.card_front;
        screenDiv.appendChild(frontDiv);

        // Make diff div
        const diffMessage = `Your answer: ${userAnswer}<br>Correct answer: ${flashcard.card_back}`;
        const diffDiv = document.createElement('div');
        diffDiv.innerHTML = diffMessage;
        screenDiv.appendChild(diffDiv);

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
            confirmButton.onclick = () => {
                setTimer(count);
                count = 0;
                screens["flashcard"].deactivate();
                screens["confirm"].deactivate();
            };
            buttonsDiv.appendChild(confirmButton);
        }

        // Edit button
        const editButton = document.createElement('button');
        editButton.textContent = 'Edit';
        editButton.onclick = () => {
            editFlashcard = flashcard;
            screens["edit"].activate();
        };
        buttonsDiv.appendChild(editButton);

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

        const cancelButton = document.createElement('button');
        cancelButton.textContent = 'Cancel';
        cancelButton.type = 'button';
        cancelButton.addEventListener('click', function() {
            screens["edit"].deactivate();
        });
        buttonsDiv.appendChild(cancelButton);

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
    }

    const loadingSvg = `<svg fill="white" width="48" height="48" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><style>.spinner_9y7u{animation:spinner_fUkk 2.4s linear infinite;animation-delay:-2.4s}.spinner_DF2s{animation-delay:-1.6s}.spinner_q27e{animation-delay:-.8s}@keyframes spinner_fUkk{8.33%{x:13px;y:1px}25%{x:13px;y:1px}33.3%{x:13px;y:13px}50%{x:13px;y:13px}58.33%{x:1px;y:13px}75%{x:1px;y:13px}83.33%{x:1px;y:1px}}</style><rect class="spinner_9y7u" x="1" y="1" rx="1" width="10" height="10"/><rect class="spinner_9y7u spinner_DF2s" x="1" y="1" rx="1" width="10" height="10"/><rect class="spinner_9y7u spinner_q27e" x="1" y="1" rx="1" width="10" height="10"/></svg>`;

    async function createListScreen() {
        screenDiv.innerHTML = ''; // Clear current content
        const fullscreenDiv = document.createElement('div');
        fullscreenDiv.id = 'blobsey-flashcard-fullscreen-div';
        screenDiv.appendChild(fullscreenDiv);

        // Create a close button
        const closeButton = document.createElement('button');
        closeButton.id = 'blobsey-flashcard-close-button';
        closeButton.addEventListener('click', function() {
            screens["list"].deactivate();
        });
        fullscreenDiv.appendChild(closeButton);
    
        // Create a container for the table
        const container = document.createElement('div');
        container.id = 'blobsey-flashcard-list-container';
        fullscreenDiv.appendChild(container);
   
        container.innerHTML =  loadingSvg;

    
        // Fetch flashcards from background.js
        try {
            const response = await browser.runtime.sendMessage({ action: "listFlashcards" });
            if (response.result === "success") {
                let flashcards = response.flashcards;

                container.innerHTML = '';

                // Create a search bar
                const searchBar = document.createElement('input');
                searchBar.id = 'blobsey-flashcard-search-bar';
                searchBar.setAttribute('type', 'text');
                searchBar.setAttribute('placeholder', 'Search flashcards...');
                fullscreenDiv.insertBefore(searchBar, container); // Insert before the container

                // tableContainer to hold table
                const tableContainer = document.createElement('div');
                tableContainer.id = 'blobsey-flashcard-list-table-container';
                container.appendChild(tableContainer);
                updateFlashcardList(tableContainer, flashcards);

                // Filter cards based on searchText
                searchBar.addEventListener('input', () => {
                    const searchText = searchBar.value.trim();
                    if (searchText) {
                        flashcards = response.flashcards.filter(card => 
                            card.card_front.toLowerCase().includes(searchText.toLowerCase()) || 
                            card.card_back.toLowerCase().includes(searchText.toLowerCase()));
                    } else {
                        // If the search bar is cleared, show all flashcards again
                        flashcards = response.flashcards;
                    }
                    updateFlashcardList(tableContainer, flashcards);
                });

            } else {
                throw new Error(response.message);
            }
        } catch (error) {
            container.innerHTML = error.message;
            console.error("Error fetching flashcards:", error);
        }
    }

    // Helper function to update list of flashcards (used with searchbar)
    function updateFlashcardList(tableContainer, flashcards) {
        tableContainer.innerHTML = ''; // Clear existing content
        tableContainer.id = 'blobsey-flashcard-list-table-container';
    
        const table = document.createElement('table');
        table.id = 'blobsey-flashcard-list-table';
        tableContainer.appendChild(table);
    
        const tbody = document.createElement('tbody');
        table.appendChild(tbody);
    
        flashcards.forEach(card => {
            const row = document.createElement('tr');
            const frontCell = document.createElement('td');
            frontCell.textContent = truncateText(card.card_front, 50);
            const backCell = document.createElement('td');
            backCell.textContent = truncateText(card.card_back, 50);
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
