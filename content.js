// content.js
// Handles UI/UX, application logic

(function() {
    /////////////////////////////////
    // Application Logic Functions //
    /////////////////////////////////

    // Fetches a flashcard by sending a message to background.js
    function nextFlashcard() {
        // Send a message to background.js to fetch a flashcard
        return browser.runtime.sendMessage({
                action: "nextFlashcard"
            })
            .then(response => {
                if (response.result === "error") {
                    console.error("Error fetching next flashcard:", response.message);
                    throw new Error(response.message);
                }

                // If no explicit errors, check for response.message and if it exists throw that as an error
                if (response.message) {
                    throw new Error(response.message);
                } else {
                    return response.flashcard;                   
                }
            });
    }

    // Edits a flashcard given a card_id
    function submitFlashcardEdit(card_id, frontText, backText) {
        return browser.runtime.sendMessage({
            action: "editFlashcard",
            card_id: card_id,
            card_front: frontText,
            card_back: backText
        }).then(response => {
            // Handle the response from the background script
            if (response.result === "success") {
                console.log("Flashcard updated successfully");
                return response.flashcard; // Return response for further processing
            } else {
                // Handle failure
                console.error("Failed to update flashcard:", response.message);
                throw new Error(response.message); // Throw an error for the caller to handle
            }
        });
    }

    // Sets alarm for "minutes" minutes to show next overlay
    function setTimer(minutes) {
        browser.runtime.sendMessage({
            action: "resetTimer",
            count: minutes
        }); // Send the current count with the message
    }

    // Iterates through DOM and pauses any media
    function pauseMediaPlayback() {
        const mediaElements = document.querySelectorAll("video, audio");
        mediaElements.forEach(media => {
            if (!media.paused) {
                media.pause();
            }
        });
    }


    // Listen for messages from the background script to show the overlay
    browser.runtime.onMessage.addListener((request, sender, sendResponse) => {
        if (request.action === "showOverlay") {
            showOverlay();
        }
    });

    // On page load, check if we should show the overlay
    browser.storage.local.get("nextOverlayTime").then(data => {
        const currentTime = Date.now();

        // Check if 'nextOverlayTime' exists
        if (data.hasOwnProperty('nextOverlayTime')) {
            // 'nextOverlayTime' exists, check if the current time is past this timestamp
            if (currentTime >= data.nextOverlayTime) {
                // Time has passed, show the overlay
                showOverlay();
            } // If time has not passed, do nothing and wait for the next alarm
        } else {
            // 'nextOverlayTime' probably got deleted, show anyways
            showOverlay();
        }
    }).catch(error => {
        console.error("Error accessing storage in content script:", error);
    });


    // Function to kick off the UI creation 
    function showOverlay() {
        // If overlay is already active, don't fire
        if (isOverlayActive) { return; }
        isOverlayActive = true;

        nextFlashcard().then(fetchedCard => {
            // If a flashcard is successfully fetched, create and show the overlay
            originalOverflowState = document.documentElement.style.overflow; // Store the original overflow state
            document.documentElement.style.overflow  = 'hidden'; // Disable scrolling
            pauseMediaPlayback();
            flashcard = fetchedCard;
            createOverlay();

        }).catch(error => {
            setTimer(1);
            throw error;
        });
    }


    
    ///////////////////////////
    // Functions to build UI //
    ///////////////////////////

    // Global State variables
    let isOverlayActive = false;
    let originalOverflowState = '';
    let flashcard = null;
    let userAnswer = '';
    let overlayDiv = null;
    let uiBox = null;
    let count = 0;
    


    // Create overlayDiv which will hold entire overlay, also darken the screen
    function createOverlay() {
        // Get the root div of the overlay and wipe it out
        overlayDiv = document.getElementById('blobsey-flashcard-overlay');
        if (!overlayDiv) {
            overlayDiv = document.createElement('div');
            overlayDiv.id = 'blobsey-flashcard-overlay';
            document.body.appendChild(overlayDiv)
        }
        overlayDiv.innerHTML = '';

        // setTimeout workaround so blur will show up
        setTimeout(() => {
            // Blur the background
            overlayDiv.style.backdropFilter = 'blur(10px)';
            overlayDiv.style.opacity = '1';
        }, 10); 
    
        // Create container for UI
        uiBox = document.createElement('div');
        uiBox.id = 'blobsey-flashcard-ui';
        overlayDiv.appendChild(uiBox);

        createFlashcardScreen();

    }


    function createFlashcardScreen() {
        // Clear out uiDiv
        uiBox.innerHTML = '';

        // Content div holds everything and styles it
        const contentDiv = document.createElement('div');
        uiBox.appendChild(contentDiv);

        const form = document.createElement('form');
        contentDiv.appendChild(form);

        const frontDiv = document.createElement('div');
        frontDiv.innerHTML = flashcard.card_front;
        form.appendChild(frontDiv);

        const userInput = document.createElement('input');
        userInput.type = 'text';
        form.appendChild(userInput);

        form.onsubmit = (event) => {
            event.preventDefault();
            userAnswer = userInput.value;
            createConfirmScreen();
        };

        userInput.focus();
    }


    function createConfirmScreen() {
        // Start by clearing the current content of overlayDiv
        uiBox.innerHTML = '';

        const contentDiv = document.createElement('div');
        uiBox.appendChild(contentDiv);

        // Show question
        const frontDiv = document.createElement('div');
        frontDiv.innerHTML = flashcard.card_front;
        contentDiv.appendChild(frontDiv);

        // Make diff div
        const diffMessage = `Your answer: ${userAnswer}<br>Correct answer: ${flashcard.card_back}`;
        const diffDiv = document.createElement('div');
        diffDiv.innerHTML = diffMessage;
        contentDiv.appendChild(diffDiv);

        // Buttons container
        const buttonsDiv = document.createElement('div');
        buttonsDiv.id = "blobsey-flashcard-buttons-div";
        contentDiv.appendChild(buttonsDiv);
        

        // Grade flashcard
        const isCorrect = userAnswer.trim().toLowerCase() === flashcard.card_back.trim().toLowerCase();
        if (isCorrect) {
            ++count;
        }

        // Send grading information
        const grade = isCorrect ? 3 : 1;

        // Does the following with strict ordering: Review -> Fetch next -> Show buttons
        browser.runtime.sendMessage({
            action: "reviewFlashcard",
            card_id: flashcard.card_id,
            grade: grade
        })
        .then(() => {
            // Attempt to fetch the next flashcard, if fetch is successful then we will add "Another" button
            return nextFlashcard()
        })
        .then(fetchedCard => {
            // Another button
            const anotherButton = document.createElement('button');
            anotherButton.textContent = 'Another';
            anotherButton.onclick = () => {
                flashcard = fetchedCard;
                createFlashcardScreen();
            };
            buttonsDiv.appendChild(anotherButton);
        })
        .catch(error => {
            // Handle the case where no more flashcards are available
            const messageDiv = document.createElement('div');
            messageDiv.innerHTML = (error.message === "No cards to review right now.") ? "No more cards to review for today! :)" : error.message;
            contentDiv.appendChild(messageDiv);
        })
        .finally(() => {
              // Confirm button 
            if (count > 0) {
                const confirmButton = document.createElement('button');
                confirmButton.textContent = 'Confirm';
                confirmButton.onclick = () => {
                    setTimer(count);
                    count = 0;
                    removeOverlay();
                };
                buttonsDiv.appendChild(confirmButton);
            }

            // Edit button
            const editButton = document.createElement('button');
            editButton.textContent = 'Edit';
            editButton.onclick = () => {
                createEditScreen();
            };
            buttonsDiv.appendChild(editButton);

            // Note for flashcard count
            const countNote = document.createElement('div');
            countNote.innerHTML = `Correct Answers: ${count}`;
            contentDiv.appendChild(countNote);

            setTimer(count); // Also set timer just in case page refresh
        });
    }

    // Helper function to make textarea grow vertically
    function adjustHeight(textarea) {
        const maxHeightVh = (window.innerHeight * 40) / 100; // 40vh == min height
        textarea.style.height = 'auto';
        textarea.style.height = `${Math.max(maxHeightVh, textarea.scrollHeight)}px`;
    }
    
    function createEditScreen() {
        uiBox.innerHTML = ''; // Clear current content

        // Front textarea input
        const form = document.createElement('form');
        const frontInput = document.createElement('textarea');
        frontInput.value = flashcard.card_front;
        frontInput.placeholder = 'Front';
        frontInput.id = 'edit-screen-textarea-front'; 

        // Make textarea expand when typing more
        frontInput.addEventListener('input', function() { adjustHeight(this) });

        form.appendChild(frontInput);
        uiBox.appendChild(form);
        
        adjustHeight(frontInput); // Initially fit textarea to content

        const backInput = document.createElement('input');
        backInput.type = 'text';
        backInput.value = flashcard.card_back;
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
            createConfirmScreen();
        });
        buttonsDiv.appendChild(cancelButton);

        const saveButton = document.createElement('button');
        saveButton.textContent = 'Save';
        saveButton.type = 'submit';
        buttonsDiv.appendChild(saveButton);

        form.onsubmit = (event) => {
            event.preventDefault();
            submitFlashcardEdit(flashcard.card_id, frontInput.value, backInput.value).then(response => {
                flashcard = response;
                createConfirmScreen();
            }).catch(error => {
                console.error(error.message);
                removeOverlay();
                setTimer(1);
            });
        };
    }


    function removeOverlay() {
        // Fade out
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
        
        
        // Restore the original overflow state (scrolling behavior)
        document.documentElement.style.overflow = originalOverflowState;

        // Reset the isOverlayActive flag
        isOverlayActive = false;
    }

})();