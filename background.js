// background.js 
// Does a lot of the heavy lifting for handling configs, API Requests

// Global variables
let openLoginWindows = new Map();
let authInfo = null;
    
// If the alarm fires, send a message to show overlay. content.js will decide if the overlay actually shows
browser.alarms.onAlarm.addListener(alarm => {
    if (alarm.name === "showFlashcardAlarm") {
        // Notify all relevant tabs to show the overlay
        browser.tabs.query({}).then((tabs) => {
            tabs.forEach((tab) => {
                try {
                    browser.tabs.sendMessage(tab.id, { action: "showFlashcardAlarm" });
                }
                catch (error) {
                    console.warn(`Couldn't send "showFlashcardAlarm" to tab ${tab.title}`);
                }
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
                throw new Error(`Message malformed: ${request}`);
            }
        } catch (error) {
            console.error(`Error handling action ${request.action}:`, error);
            sendResponse({ result: "error", message: error.message });
        }
    })();

    return true; // Indicates sendResponse will be sent asynchronously
});


// Handlers for requests
const requestHandlers = {
    "setBlankHtmlData": async (request) => {
        await browser.storage.local.set({ blankHtmlData: request.data });
        return "Set blank.html data successfully";
    },
    "getBlankHtmlData": async (request) => {
        return await browser.storage.local.get("blankHtmlData");
    },
    "getApiBaseUrl": async () => {
        const { apiBaseUrl } = await browser.storage.local.get("apiBaseUrl");
        return apiBaseUrl ? { apiBaseUrl } : { apiBaseUrl: 'https://flashcard-api.blobsey.com' };
    },
    "setApiBaseUrl": async (request) => {
        await browser.storage.local.set({ apiBaseUrl: request.apiBaseUrl });
        return "Set API Base URL successfully.";
    },
    "setTimestampAlarm": async (request) => {
        // Calculate minutes for browser.alarms.create()
        await browser.alarms.clear("showFlashcardAlarm");
        const nextFlashcardTime = request.nextFlashcardTime || Date.now();
        const minutes = (nextFlashcardTime - Date.now()) / 60000; 
        await browser.alarms.create("showFlashcardAlarm", { delayInMinutes: minutes });

        // Also set precise timestamp in local storage
        await browser.storage.local.set({ nextFlashcardTime }); 

        console.log(`Next flashcard: \t${new Date(nextFlashcardTime).toLocaleString()}`);
        return "Timer reset successfully.";
    },
    "confirmAllTabs": async (request) => {
        // Close any open overlays on logout
        browser.tabs.query({}, function(tabs) {
            tabs.forEach(function(tab) {
                browser.tabs.sendMessage(tab.id, {action: "confirmAllTabs"})
                .catch(() => {
                    console.warn(`Failed closing overlay on ${tab.title} (tab ID ${tab.id})`);
                })
            });
        });
    },
    "login": async () => {
        try {
            const { apiBaseUrl } = await requestHandlers["getApiBaseUrl"]();
            const loginWindow = await browser.windows.create({
                url: `${apiBaseUrl}/login`,
                type: 'popup',
                width: 500,
                height: 600
            });
    
            // Add the window to the Map
            openLoginWindows.set(loginWindow.id, loginWindow);
    
            // Get the tab ID of the login window
            const tabId = loginWindow.tabs[0].id;
    
            // Listen for updates to the login tab
            browser.tabs.onUpdated.addListener(async (updatedTabId, changeInfo, tab) => {
                if (updatedTabId === tabId && changeInfo.status === 'complete' && tab.url.startsWith(`${apiBaseUrl}/auth`)) {
                    // Authentication completed, close the login window after 3 seconds
                    setTimeout(async () => {
                        try {
                            await browser.windows.remove(loginWindow.id);
                            openLoginWindows.delete(loginWindow.id);
                        } catch (error) {
                            console.error(`Failed to close login window ${loginWindow.id}:`, error);
                        }
                    }, 3000);
    
                    // Validate authentication
                    const data = await handleApiRequest("/validate-authentication");
                    if (data.message && data.message === "Authentication valid") {
                        console.log("Authentication successful");
                    } else {
                        console.error("Authentication failed");
                    }
                }
            });
    
        } catch (error) {
            console.error('Failed to initiate login:', error);
            // Attempt to close any potentially open login windows in case of error
            openLoginWindows.forEach(async (value, key) => {
                try {
                    await browser.windows.remove(key);
                } catch (ignore) {
                    // Error handling for window closing, if necessary
                }
            });
            openLoginWindows.clear(); // Clear the Map after handling errors
        }
    },
    "logout": async () => {
        authInfo = null;
        const data = await handleApiRequest("/logout");
        return data;
    },
    "validateAuthentication": async () => {
        try {
            const data = await handleApiRequest("/validate-authentication");
            return data;
        }
        catch (error) { 
            return {message: "Authentication invalid"};
        }
    },
    "fetchNextFlashcard": async () => {
        const data = await handleApiRequest("/next");
        return data;
    },
    "editFlashcard": async (request) => {
        const body = { card_front: request.card_front, card_back: request.card_back };
        const data = await handleApiRequest(`/edit/${request.card_id}`, {
            method: 'PUT',
            body: { 
                card_front: request.card_front, 
                card_back: request.card_back 
            }
        });
        return data;
    },
    "reviewFlashcard": async (request) => {
        const data = await handleApiRequest(`/review/${request.card_id}`, {
            method: 'POST',
            body: {
                grade: request.grade
            }
        });
        return data;
    },
    "addFlashcard": async (request) => {
        const data = await handleApiRequest('/add', {
            method: 'POST',
            body: { 
                card_front: request.card_front, 
                card_back: request.card_back,
                deck: request.deck
            }
        });
        return data;
    },
    "listFlashcards": async (request) => {
        const deck = request.deck; // Get the deck parameter from the request
        const data = await handleApiRequest(`/list?deck=${encodeURIComponent(deck)}`);
        return data;
    },
    "deleteFlashcard": async (request) => {
        const data = await handleApiRequest(`/delete/${request.card_id}`, {
            method: 'DELETE'
        });
        return data;
    },
    "authInfo": async (request) => {
        if (!authInfo) {
            authInfo = await handleApiRequest("/auth-info");
        }
        return authInfo;
    },
    "getUserData": async () => {
        return await handleApiRequest("/user-data", {
            method: 'GET'
        });
    },
    "setUserData": async (request) => {
        return await handleApiRequest("/user-data", {
            method: 'PUT',
            body: request.userData
        });
    },
    "createDeck": async (request) => {
        const deck = request.deck;
        const data = await handleApiRequest(`/create-deck/${encodeURIComponent(deck)}`, {
            method: 'PUT'
        });
        return data;
    },
    "deleteDeck": async (request) => {
        const deck = request.deck;
        const data = await handleApiRequest(`/delete-deck/${encodeURIComponent(deck)}`, {
            method: 'DELETE'
        });
        return data;
    },
    "renameDeck": async (request) => {
        const data = await handleApiRequest("/rename-deck", {
            method: 'PUT',
            body: {
                old_deck_name: request.oldDeckName,
                new_deck_name: request.newDeckName
            }
        });
        return data;
    },
    "uploadDeck": async (request) => {
        const formData = new FormData();
        formData.append('file', request.file, request.file.name);
        formData.append('deck', request.deck);

        const data = await handleApiRequest("/upload", {
            method: 'POST',
            body: formData
        });
        return data;
    },
    "downloadDeck": async (request) => {
        return await handleApiRequest(`/download?deck=${encodeURIComponent(request.deck)}`);
    }
};


async function handleApiRequest(path, options = {}) {
    // Fetch the API Base URL
    const { apiBaseUrl } = await requestHandlers["getApiBaseUrl"]();
    
    // Construct the full URL
    const url = `${apiBaseUrl}${path}`;

    // Set content-type to application/json by default due to firefox weirdness
    if (options.body && !(options.body instanceof FormData)) {
        options.headers = { 'Content-Type': 'application/json' };
        options.body = JSON.stringify(options.body);
    }

    // Include credentials (cookies) in the request
    options.credentials = 'include';

    const response = await fetch(url, options);
    const contentType = response.headers.get('Content-Type', '');

    if (!response.ok) { // If response not in 200-299
        let error;
    
        // If type is 'application/json' try to parse and rethrow error
        if (contentType && contentType.includes('application/json')) {
            const errorDetails = await response.json();
            error = new Error(`API Request not ok: ${JSON.stringify(errorDetails) || response.statusText}`);
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
    } 
    else if (contentType && contentType.includes('text/csv')) { // If file download, handle it here
        // Get filename from Content-Disposition header
        const disposition = response.headers.get('Content-Disposition');
        let filename = disposition.split(/;(.+)/)[1].split(/=(.+)/)[1];
        if (filename.toLowerCase().startsWith("utf-8''"))
            filename = decodeURIComponent(filename.replace("utf-8''", ''));
        else
            filename = filename.replace(/['"]/g, '');

        // Generate download URL and click it
        const blob = await response.blob();
        const downloadUrl = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = downloadUrl;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        a.remove();
        return { message: "Hello!" };
    }
    else {
        return await response.text();
    }
}



// When extension is started, schedule a flashcard to initialize
browser.storage.local.set({ nextFlashcardTime: Date.now() });