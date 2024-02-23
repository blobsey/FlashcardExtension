// Fetches the nextflashcard by
// Throws an error if there are no cards due
function nextFlashcard() {
    // Send a message to background.js to fetch a flashcard
    return browser.runtime.sendMessage({action: "nextFlashcard"})
    .then(response => {
        if (response.result === "error") {
            console.error("Error fetching next flashcard:", response.message);
            throw new Error(response.message);
        }

        // If no explicit errors, check for response.data.message and if it exists throw that as an error
        if (response.data) {
            if (response.data.message) {
                throw new Error(response.data.message);
            }
            else {
                return response.data; // response.data holds a flashcard object
            }
        }
    });
}

// Gets a specific flashcard by id. Not used to fetch the "next" flashcard
function getFlashcard(cardId) {
    // Return the promise chain so that it can be used outside this function
    return browser.runtime.sendMessage({
        action: "getFlashcard",
        cardId: cardId
    }).then(response => {
        if (response.result === "success") {
            console.log("Fetched flashcard successfully");
            return response.flashcard; // Ensure to return the flashcard for the next then() in the chain
        } else {
            console.error("Failed to fetch flashcard:", response.message);
            throw new Error(response.message); // Throw an error to be caught in catch()
        }
    }).catch(error => {
        console.error("Error fetching updated flashcard:", error);
        throw error; // Re-throw the error to be caught by the calling code
    });
}

function showOverlay() {
    nextFlashcard().then(flashcard => {
        // If a flashcard is successfully fetched, create and show the overlay
        pauseMediaPlayback();
        createFlashcardOverlay(flashcard);

    }).catch(error => {
        // If there are no cards to review or any other error occurs, log it
        console.error(error.message);
        setTimer(1);
    });
}


function injectOverlayStyles() {
    const styleId = 'myOverlayStyles'; // Unique ID for the stylesheet

    if (!document.getElementById(styleId)) {
        const style = document.createElement('style');
        style.id = styleId;
        style.textContent = `
            #darken {
                position: fixed; top: 0; left: 0; width: 100%; height: 100%;
                background: rgba(0, 0, 0, 0.5); z-index: 9998;
            }
            #overlay, #overlay * {
                all: initial;
                box-sizing: border-box;
            }
            #overlay {
                position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%);
                max-width: 60em; width: 90%; height: auto; max-height: 90%; margin: auto; padding: 2em;
                background: rgba(0, 0, 0, 0.75); border-radius: 15px; color: white;
                display: flex; flex-direction: column; align-items: center;
                font-family: 'Arial Black', sans-serif; box-shadow: 0 4px 6px rgba(0,0,0,0.1);
                overflow-y: auto; z-index: 10000;
            }
            #overlay div, #overlay input, #overlay button {
                font-family: 'Trebuchet MS', sans-serif; color: white;
            }
            #overlay input {
                border: 2px solid rgba(255, 255, 255, 0.5); background: none;
                border-radius: 15px; outline: none;
            }
            #overlay button {
                display: flex;
                justify-content: center;
                align-items: center;
                text-align: center; /* Ensures text alignment for browsers that don't fully support flexbox */
                width: 6em;
                padding: 10px 20px; /* Adjust padding as needed */
                margin-top: 20px;
                font-size: 16px;
                cursor: pointer;
                border: 2px solid rgba(255, 255, 255, 0.5);
                background: none;
                margin: 0 10px;
                border-radius: 15px;
                outline: none;
                transition: background-color 0.3s, border-color 0.3s, color 0.3s;
            }            
            #overlay button:focus {
                background-color: rgba(255, 255, 255, 0.2); /* Slightly visible background */
                border-color: rgba(255, 255, 255, 0.75);
            }
            #overlay button:active {
                background-color: rgba(255, 255, 255, 0.3); /* More visible background for active state */
                border-color: white; /* Brighter border for active state */
            }
            #overlay pre, #overlay code {
                white-space: pre-wrap;
                display: block;
                font-size: 16px; /* Good for readability */
                overflow-x: auto; /* Allows horizontal scrolling for long lines */
                font-family: 'Fira Code', monospace; /* Using a web-friendly monospace font */
                color: #d1d5db; /* Soft white/gray for less harsh contrast */
                background-color: rgba(0, 0, 0, .25); /* Dark background for contrast */
                padding: .5em; /* Adds space inside the elements */
                border-radius: 4px; /* Softens the corners */
                border: 1px solid rgba(255, 255, 255, .1); /* Subtle border to define the edges */
            }         

            /* Shared styles for inputs and textareas */
            #overlay .edit-screen-input-back, 
            #overlay .edit-screen-textarea-front {
                font-size: 16px;
                font-family: 'Fira Code', monospace;
                margin: 10px 0;
                background-color: #000; /* Black background */
                color: #d1d5db; /* Soft white/gray text for contrast */
                border: 2px solid rgba(255, 255, 255, 0.1); /* Transparent greyish white border */
                border-radius: 5px;
                box-shadow: 0 2px 4px rgba(0,0,0,0.1);
                outline: none;
                transition: border-color 0.3s;
            }

            #overlay .edit-screen-textarea-front {
                width: 100%;
                height: 20em;
                padding: 10px;
                overflow-y: auto;
                display: block;
                white-space: pre-wrap;
                resize: vertical; /* Make the textarea vertically resizable */
            }

            #overlay .edit-screen-input-back {
                width: 40%;
                padding: 8px;
                text-align: center;
            }

            #overlay .edit-screen-input-back:focus, 
            #overlay .edit-screen-textarea-front:focus {
                border-color: #007bff; /* Highlight color when focused */
            }

            /* Styling the form for greater width */
            #overlay form {
                width: 90%;
                max-width: 600px;
                display: flex;
                flex-direction: column;
                align-items: center;
                margin: auto;
            }
        `;
        document.head.appendChild(style);
    }
}



let overlayActive = false;
let originalOverflowState = '';


function createFlashcardOverlay(flashcard) {
    if (overlayActive) return;
    overlayActive = true;

    injectOverlayStyles();

    originalOverflowState = document.documentElement.style.overflow; // Store the original overflow state
    document.documentElement.style.overflow = 'hidden';

    let darken = document.createElement('div');
    darken.id = 'darken';
    document.body.appendChild(darken);

    let overlayDiv = document.createElement('div');
    overlayDiv.id = 'overlay';
    document.body.appendChild(overlayDiv);

    createFlashcardScreen(overlayDiv, flashcard, 0);
}

function createFlashcardScreen(overlayDiv, flashcard, count) {
    // Clear out overlayDiv
    overlayDiv.innerHTML = '';

    // Content div holds everything and styles it
    const contentDiv = document.createElement('div');
    contentDiv.style.cssText = 'width: 100%; display: flex; flex-direction: column; align-items: center;';
    overlayDiv.appendChild(contentDiv);

    const form = document.createElement('form');
    form.style.cssText = 'width: 100%; display: flex; flex-direction: column; align-items: center;';
    contentDiv.appendChild(form);

    const frontDiv = document.createElement('div');
    frontDiv.style.whiteSpace = 'pre-wrap';
    frontDiv.innerHTML = flashcard.front;
    form.appendChild(frontDiv);

    const userInput = document.createElement('input');
    userInput.type = 'text';
    userInput.style.cssText = 'width: 80%; margin-top: 1em; padding: 0.5em; font-size: 16px;';
    form.appendChild(userInput);

    form.onsubmit = (event) => {
        event.preventDefault();

        // Grade flashcard
        const isCorrect = userInput.value.trim().toLowerCase() === flashcard.back.trim().toLowerCase();
        if (isCorrect) { ++count; }
        
        // Send grading information
        const grade = isCorrect ? 3 : 1;
        browser.runtime.sendMessage({
            action: "reviewFlashcard",
            cardId: flashcard.id,
            grade: grade
        });

        createConfirmScreen(overlayDiv, userInput, flashcard, count);
    };

    userInput.focus();
}


function createConfirmScreen(overlayDiv, userInput, flashcard, count) {
    // Start by clearing the current content of overlayDiv
    overlayDiv.innerHTML = '';

    const contentDiv = document.createElement('div');
    contentDiv.style.cssText = 'width: 100%; display: flex; flex-direction: column; align-items: center;';
    overlayDiv.appendChild(contentDiv);

    // Show question
    const frontDiv = document.createElement('div');
    frontDiv.innerHTML = flashcard.front;
    contentDiv.appendChild(frontDiv);

    // Make diff div
    const diffMessage = `Your answer: ${userInput.value}<br>Correct answer: ${flashcard.back}`;
    const diffDiv = document.createElement('div');
    diffDiv.innerHTML = diffMessage;
    diffDiv.style.display = 'block';
    diffDiv.style.cssText = 'width: 80%; margin-top: 1em; text-align: center; padding: 0.5em; font-size: 16px;';
    contentDiv.appendChild(diffDiv);

    // Buttons container
    const buttonsDiv = document.createElement('div');
    buttonsDiv.style.cssText = 'display: flex; justify-content: center; width: 100%;';
    contentDiv.appendChild(buttonsDiv);

    // Attempt to fetch the next flashcard, if fetch is successful then we will add "Another" button
    nextFlashcard().then(nextFlashcard => {
        // Another button
        const anotherButton = document.createElement('button');
        anotherButton.textContent = 'Another';
        anotherButton.onclick = () => {
            createFlashcardScreen(overlayDiv, nextFlashcard, count);
        };
        buttonsDiv.appendChild(anotherButton);

    }).catch(error => {
        // Handle the case where no more flashcards are available
        const messageDiv = document.createElement('div');
        messageDiv.innerHTML = (error.message === "No cards to review right now.") ? "No more cards to review for today! :)" : error.message;
        messageDiv.style.cssText = 'text-align: center; padding: 20px;';
        overlayDiv.appendChild(messageDiv);

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
            createEditScreen(overlayDiv, flashcard, count, userInput);
        };
        buttonsDiv.appendChild(editButton);


        // Note for flashcard count
        const countNote = document.createElement('div');
        countNote.innerHTML = `Correct Answers: ${count}`;
        countNote.style.cssText = 'margin-top: 20px; font-size: 0.9em;';
        contentDiv.appendChild(countNote);
    
        setTimer(1); // Set timer as a fallback or according to specific logic
    });
}

function createEditScreen(overlayDiv, flashcard, count = 0, userInput = null) {
    overlayDiv.innerHTML = ''; // Clear current content

    const form = document.createElement('form');
    form.style.cssText = 'display: flex; flex-direction: column; align-items: center;';

    // Use textarea for the front input to allow multi-line text
    const frontInput = document.createElement('textarea');
    frontInput.value = flashcard.front;
    frontInput.placeholder = 'Front';
    frontInput.className = 'edit-screen-textarea-front'; // Adjusted class name
    form.appendChild(frontInput);

    const backInput = document.createElement('input');
    backInput.type = 'text';
    backInput.value = flashcard.back;
    backInput.placeholder = 'Back';
    backInput.className = 'edit-screen-input-back'; // No change here
    form.appendChild(backInput);

    const saveButton = document.createElement('button');
    saveButton.textContent = 'Save';
    saveButton.type = 'submit';
    form.appendChild(saveButton);

    overlayDiv.appendChild(form);

    form.onsubmit = (event) => {
        event.preventDefault();
        submitFlashcardEdit(flashcard.id, frontInput.value, backInput.value).then(response => { 
            createConfirmScreen(overlayDiv, userInput, response.data.flashcard, count);
        }).catch(error => {
            console.error(error.message);
            setTimer(1);
        });
    };
}


function submitFlashcardEdit(cardId, frontText, backText) {
    return browser.runtime.sendMessage({
        action: "editFlashcard",
        cardId: cardId,
        front: frontText,
        back: backText
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




function removeOverlay() {
    // Find and remove the darken element
    let darken = document.getElementById('darken');
    if (darken) darken.remove();

    // Find and remove the overlayDiv element
    let overlayDiv = document.getElementById('overlay');
    if (overlayDiv) overlayDiv.remove();

    // Restore the original overflow state
    document.documentElement.style.overflow = originalOverflowState;

    // Reset the overlayActive flag
    overlayActive = false;
}


function setTimer(minutes) {
    browser.runtime.sendMessage({
        action: "resetTimer",
        count: minutes
    }); // Send the current count with the message
}

function pauseMediaPlayback() {
    const mediaElements = document.querySelectorAll("video, audio");
    mediaElements.forEach(media => {
        if (!media.paused) {
            media.pause();
        }
    });
}

// Listen for messages from the background script
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

