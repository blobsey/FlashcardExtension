// background.js 
// Does a lot of the heavy lifting for handling configs, API Requests

browser.tabs.insertCSS({file: 'styles.css'}); // Inject CSS

    
// If the alarm fires, send a message to show overlay. content.js will decide if the overlay actually shows
browser.alarms.onAlarm.addListener(alarm => {
  if (alarm.name === "showFlashcardAlarm") {
      // Notify all relevant tabs to show the overlay
      browser.tabs.query({url: ["*://*.reddit.com/*", "*://*.youtube.com/*", "*://crouton.net/*"]})
          .then(tabs => {
              tabs.forEach(tab => {
                  browser.tabs.sendMessage(tab.id, {action: "showFlashcard"}).catch(err => console.error(err));
              });
          }); 
  }
});


// Boilerplate to turn a browser message into corresponding function
browser.runtime.onMessage.addListener((request, sender, sendResponse) => {
    (async () => { // functions are async, so need to use async IIFE
        try {
            if (requestHandlers.hasOwnProperty(request.action)) {
                const data = await requestHandlers[request.action](request);
                sendResponse({ result: "success", ...data });
            } else {
                throw new Error("Unknown action");
            }
        } catch (error) {
            console.error(`Error handling action ${request.action}:`, error);
            sendResponse({ result: "error", message: error.message });
        }
    })();

    return true; // This is crucial to indicate that sendResponse will be called asynchronously
});

const defaultConfig = {
    apiBaseUrl: 'https://flashcard-api.blobsey.com',
    apiKey: '',
};

// Function to get config with defaults
async function getConfig() {
    try {
        const { config } = await browser.storage.local.get("config");

        // Check if config is an object
        if (config && typeof config === 'object') {
            // Fetch config, fill in any default values
            const mergedConfig = {
                ...defaultConfig, // Start with defaultConfig
                ...config // Override with values from config where they exist
            };

            return mergedConfig;
        } else {
            // If config is not an object, return defaultConfig
            return defaultConfig;
        }
    } catch (error) {
        console.error("Error loading config:", error);
        // Return defaultConfig in case of any error
        return defaultConfig;
    }
}



// Handlers for requests
const requestHandlers = {
    "getConfig": async () => {
        const config = await getConfig();
        return {config};
    },
    "setConfig": async (request) => {
        await browser.storage.local.set({ config: request.config });
        return {config: request.config};
    },
    "resetTimer": async (request) => {
        await browser.alarms.clear("showFlashcardAlarm");
        const nextFlashcardTime = Date.now() + (60000 * request.count); // Current time + interval * 1 minute

        console.log(`Next overlay time (datetime):\t${new Date(nextFlashcardTime).toLocaleString()}`);
    
        await browser.storage.local.set({ nextFlashcardTime }); // set in local storage as a fallback
        browser.alarms.create("showFlashcardAlarm", { delayInMinutes: request.count });
        return "Timer reset successfully.";
    },
    "fetchNextFlashcard": async () => {
        const data = await handleApiRequest("/next");
        return data;
    },
    "editFlashcard": async (request) => {
        const body = { card_front: request.card_front, card_back: request.card_back };
        const data = await handleApiRequest(`/edit/${request.card_id}`, {
            method: 'PUT',
            body: body
        });
        return data;
    },
    "reviewFlashcard": async (request) => {
        const body = { grade: request.grade };
        const data = await handleApiRequest(`/review/${request.card_id}`, {
            method: 'POST',
            body: body
        });
        return data;
    },
    "addFlashcard": async (request) => {
        const body = { card_front: request.card_front, card_back: request.card_back };
        const data = await handleApiRequest('/add', {
            method: 'POST',
            body: JSON.stringify(body) // No need to include user_id here
        });
        return data;
    },
    "listFlashcards": async (request) => {
        const data = await handleApiRequest("/list");
        return data;
    },
    "deleteFlashcard": async (request) => {
        const data = await handleApiRequest(`/delete/${request.card_id}`, {
          method: 'DELETE'
        });
        return data;
    }
};


async function handleApiRequest(path, options = {}) {
    // Fetch the configuration to get the API base URL and API key
    const config = await getConfig();
    
    // Construct the full URL
    const baseUrl = config.apiBaseUrl || "https://flashcard-api.blobsey.com";
    const url = `${config.apiBaseUrl}${path}`

    // Ensure headers object exists in options to add Content-Type and API Key
    if (!options.headers) {
        options.headers = {};
    }

    // Add the API Key to the request headers
    options.headers['X-API-Key'] = config.apiKey; // Ensure to access 'config' property correctly

    // Set default header for JSON content if not already set
    options.headers['Content-Type'] = options.headers['Content-Type'] || 'application/json';

    // Stringify the body if it's an object and content type is JSON
    if (options.body && typeof options.body === 'object' && options.headers['Content-Type'] === 'application/json') {
        options.body = JSON.stringify(options.body);
    }


    const response = await fetch(url, options);
    const contentType = response.headers.get('Content-Type');

    if (!response.ok) { // If response not in 200-299
        let error;

        // If type is 'application/json' try to parse and rethrow error
        if (contentType && contentType.includes('application/json')) {
            const errorDetails = await response.json();
            error = new Error(`API Request not ok: ${errorDetails.detail || response.statusText}`);
            error.details = errorDetails;
        } else { // If not 'application/json' then parse as plaintext
            const errorText = await response.text();
            error = new Error(`API Request not ok: ${errorText || response.statusText}`);
            error.responseText = errorText;
        }

        error.status = response.status;
        error.statusText = response.statusText;
        console.error(error);
        throw error;
    }

    // Return the response according to content type
    if (contentType && contentType.includes('application/json')) {
        return await response.json();
    } else {
        return await response.text();
    }
}



// When extension is started, schedule a flashcard to initialize
browser.storage.local.set({ nextFlashcardTime: Date.now() });