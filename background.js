// background.js 
// Does a lot of the heavy lifting for handling configs, API Requests

browser.tabs.insertCSS({file: 'styles.css'}); // Inject CSS



    
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


// Boilerplate to turn a browser message into corresponding function
browser.runtime.onMessage.addListener((request, sender, sendResponse) => {
    (async () => { // functions are async, so need to use async IIFE
        try {
            if (requestHandlers.hasOwnProperty(request.action)) {
                const data = await requestHandlers[request.action](request);
                sendResponse({ result: "success", data });
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


// Function to get config
async function getConfig() {
    const { config } = await browser.storage.local.get("config"); // immediately destructure to avoid having to do config.config
    if (!config) { throw new Error("Config not found."); }
    return config;
}

// Handlers for requests
const requestHandlers = {
    "getConfig": async () => {
        const config = await getConfig();
        return config;
    },
    "setConfig": async (request) => {
        await browser.storage.local.set({ config: request.config });
        return request.config;
    },
    "resetTimer": async (request) => {
        await browser.alarms.clear("showOverlayAlarm");
        const nextOverlayTime = Date.now() + (60000 * request.count); // Current time + interval * 1 minute

        console.log(`Next overlay time (datetime):\t${new Date(nextOverlayTime).toLocaleString()}`);
    
        await browser.storage.local.set({ nextOverlayTime }); // set in local storage as a fallback
        browser.alarms.create("showOverlayAlarm", { delayInMinutes: request.count });
        return "Timer reset successfully.";
    },
    "nextFlashcard": async () => {
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

    // Check if the response is OK (status in the range 200-299)
    if (!response.ok) {
        throw new Error(`Network response from API was not ok (status: ${response.status}, statusText: ${response.statusText})`);
    }

    // Parse the response body as JSON
    const data = await response.json();

    console.log(data);

    return data; // Return the parsed JSON data
}



// When extension is started, schedule a flashcard to initialize
browser.storage.local.set({ nextOverlayTime: Date.now() });