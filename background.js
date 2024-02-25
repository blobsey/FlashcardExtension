    function getApiBaseUrl() {
    return browser.storage.local.get("API_BASE_URL").then(storage => {
        if (storage.API_BASE_URL) {
            // Return the API base URL if it exists
            return storage.API_BASE_URL;
        } else {
            throw new Error("API_BASE_URL not configured");
        }
    });
}

  

function setAlarmForOverlay(interval) {
  const nextOverlayTime = Date.now() + (60000 * interval); // Current time + 1 minute in milliseconds

  const currentTime = Date.now();
  const currentDateTime = new Date(currentTime);
  const nextOverlayDateTime = new Date(nextOverlayTime);

  // Use toLocaleString() or similar methods to get a human-readable format
  console.log(`Current time (datetime):\t${currentDateTime.toLocaleString()} \nNext overlay time (datetime):\t${nextOverlayDateTime.toLocaleString()}`);


  browser.storage.local.set({ nextOverlayTime }).then(() => {
    // Set or replace an alarm to show the overlay
    browser.alarms.create("showOverlayAlarm", { delayInMinutes: interval });
  })
  
}
    
// If the alarm fires, send a message to show overlay. content.js will decide if the overlay actually shows
browser.alarms.onAlarm.addListener(alarm => {
  if (alarm.name === "showOverlayAlarm") {
      // Notify all relevant tabs to show the overlay
      browser.tabs.query({url: ["*://*.reddit.com/*", "*://*.youtube.com/*", "*://crouton.net/*"]})
          .then(tabs => {
              tabs.forEach(tab => {
                  browser.tabs.sendMessage(tab.id, {action: "showOverlay"}).catch(err => console.error(err));
              });
          }); 
  }
});


browser.browserAction.onClicked.addListener(() => {
    browser.tabs.create({ url: browser.runtime.getURL('configuration.html') });
  });
  

// Listen for a reset message from content scripts
browser.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "resetTimer") {
      // Clear the existing alarm and set a new one to reset the timer
      browser.alarms.clear("showOverlayAlarm").then(() => {
          setAlarmForOverlay(request.count);
      });
  }
});


// handle messages
browser.runtime.onMessage.addListener((request, sender, sendResponse) => {
    switch (request.action) {
        case "resetTimer": // Set timer (alarm) for `count` minutes in the future, count == number of correct flashcards
            browser.alarms.clear("showOverlayAlarm").then(() => {
                setAlarmForOverlay(request.count);
                sendResponse({ result: "success", message: "Timer reset successfully." });
            }).catch(error => {
                console.error(`Error resetting timer:`, error.message);
                sendResponse({ result: "error", message: error.message });
            });
            return true; // Indicate an asynchronous response

        case "nextFlashcard":
        case "editFlashcard":
        case "getFlashcard":
        case "reviewFlashcard":
            handleApiRequests(request, sendResponse);
            return true; // Indicate an asynchronous response

        default:
            console.error("Unknown action:", request.action);
            sendResponse({ result: "error", message: "Unknown action" });
            // No need to return true here since we're synchronously sending a response
    }
});


function handleApiRequests(request, sendResponse) {
    getApiBaseUrl().then(API_BASE_URL => {
        let url;
        // Include the 'X-API-Key' in the headers object
        const headers = {
            'Content-Type': 'application/json',
            'X-API-Key': 'testkey' // Replace 'your_api_key_here' with your actual API key
        };
        let body = null;
        let method = 'GET'; // Default method is GET

        // Determine the appropriate URL and method based on the action
        switch (request.action) {
            case "nextFlashcard":
                url = `${API_BASE_URL}/next`;
                break;
            case "editFlashcard":
                url = `${API_BASE_URL}/edit/${request.card_id}`;
                method = 'PUT';
                body = JSON.stringify({ card_front: request.card_front, card_back: request.card_back });
                break;
            case "getFlashcard":
                url = `${API_BASE_URL}/get/${request.card_id}`;
                break;
            case "reviewFlashcard":
                url = `${API_BASE_URL}/review/${request.card_id}`;
                method = 'POST';
                body = JSON.stringify({ grade: request.grade });
                break;
        }

        // Perform the fetch operation
        fetch(url, { method, headers, ...(body && { body }) })
            .then(response => {
                if (!response.ok) {
                    throw new Error(`Network error: ${response.status} ${response.statusText}`);
                }
                return response.json();
            })
            .then(data => {
                if (data.error) { // Assuming your API responds with an error property for logical errors
                    throw new Error(`API error: ${data.error}`);
                }
                sendResponse({ result: "success", data: data });
            })
            .catch(error => {
                console.error(`Error in ${request.action}:`, error.message);
                sendResponse({ result: "error", message: error.message });
            });
    }).catch(err => {
        console.error('Error retrieving API base URL:', err);
        sendResponse({ result: "error", message: err.toString() });
    });
}



// When extension is started, schedule a flashcard to initialize
browser.storage.local.set({ nextOverlayTime: Date.now() });