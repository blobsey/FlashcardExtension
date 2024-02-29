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

                // If no explicit errors, check for response.data.message and if it exists throw that as an error
                if (response.data) {
                    if (response.data.message) {
                        throw new Error(response.data.message);
                    } else {
                        return response.data; // response.data holds a flashcard object
                    }
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
                return response; // Return response for further processing
            } else {
                // Handle failure
                console.error("Failed to update flashcard:", response.message);
                throw new Error(response.message); // Throw an error for the caller to handle
            }
        }).catch(error => {
            // Handle errors in sending the message
            console.error("Error sending message to background script:", error);
            throw error; // Rethrow to allow the caller to handle it
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
            document.documentElement.style.overflow = 'hidden'; // Disable scrolling
            pauseMediaPlayback();
            flashcard = fetchedCard;
            createOverlay();

        }).catch(error => {
            // If there are no cards to review or any other error occurs, log it
            console.error(error.message);
            setTimer(1);
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
    
        // Animate blur/darken 
        setTimeout(() => {
            overlayDiv.style.backdropFilter = 'blur(10px)';
            overlayDiv.style.backgroundColor = 'rgba(0, 0, 0, 0.75)';
        }, 10); // A delay of 10 milliseconds

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

            // Grade flashcard
            const isCorrect = userInput.value.trim().toLowerCase() === flashcard.card_back.trim().toLowerCase();
            if (isCorrect) {
                ++count;
            }

            // Send grading information
            const grade = isCorrect ? 3 : 1;
            browser.runtime.sendMessage({
                action: "reviewFlashcard",
                card_id: flashcard.card_id,
                grade: grade
            });

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

        // Attempt to fetch the next flashcard, if fetch is successful then we will add "Another" button
        nextFlashcard().then(fetchedCard => {
            // Another button
            const anotherButton = document.createElement('button');
            anotherButton.textContent = 'Another';
            anotherButton.onclick = () => {
                flashcard = fetchedCard;
                createFlashcardScreen();
            };
            buttonsDiv.appendChild(anotherButton);

        }).catch(error => {
            // Handle the case where no more flashcards are available
            const messageDiv = document.createElement('div');
            messageDiv.innerHTML = (error.message === "No cards to review right now.") ? "No more cards to review for today! :)" : error.message;
            contentDiv.appendChild(messageDiv);

            setTimer(1); // Set timer to 1 just in case new cards get added

        }).finally(() => {
            // Confirm button 
            if (count > 0) {
                const confirmButton = document.createElement('button');
                confirmButton.textContent = 'Confirm';
                confirmButton.onclick = () => {
                    setTimer(count);
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

            setTimer(1); // Set timer as a fallback or according to specific logic
        });
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
        frontInput.addEventListener('input', function() {
            this.style.height = 'auto'; 
            this.style.height = (this.scrollHeight) + 'px';
        });

        form.appendChild(frontInput);
        uiBox.appendChild(form);

        const backInput = document.createElement('input');
        backInput.type = 'text';
        backInput.value = flashcard.card_back;
        backInput.placeholder = 'Back';
        backInput.id = 'edit-screen-input-back'; 
        form.appendChild(backInput);

        const saveButton = document.createElement('button');
        saveButton.textContent = 'Save';
        saveButton.type = 'submit';
        form.appendChild(saveButton);


        form.onsubmit = (event) => {
            event.preventDefault();
            submitFlashcardEdit(flashcard.card_id, frontInput.value, backInput.value).then(response => {
                createConfirmScreen();
            }).catch(error => {
                console.error(error.message);
                setTimer(1);
            });
        };
    }





    function removeOverlay() {
        // Fade out
        if (overlayDiv) {
            overlayDiv.addEventListener('transitionend', function handler(e) {
                console.log(e);
                overlayDiv.remove();
                overlayDiv.removeEventListener('transitionend', handler); // Clean up the event listener
            }, false);
            overlayDiv.style.backdropFilter = 'blur(0px)';
            overlayDiv.style.backgroundColor = 'rgba(0, 0, 0, 0)';
        }
            

        // Restore the original overflow state
        document.documentElement.style.overflow = originalOverflowState;

        // Reset the overlayActive flag
        overlayActive = false;
    }

})();