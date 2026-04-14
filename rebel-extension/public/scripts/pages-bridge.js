const SITE_APP = "rebelremind-site";
const EXTENSION_APP = "rebelremind-extension";
const ALLOWED_ORIGINS = new Set([
  "https://rebelremind.github.io",
  "https://rebelremind.com",
  "https://www.rebelremind.github.io",
  "https://www.rebelremind.com",
  "http://localhost:5173",
  "http://127.0.0.1:5173",
]);

function isAllowedOrigin(origin) {
  return ALLOWED_ORIGINS.has(origin);
}

function postToPage(origin, type, requestId = null, payload = null) {
  window.postMessage({ type, app: EXTENSION_APP, requestId, payload }, origin);
}

function requestBridgeState(origin, requestId = null, responseType = "REBEL_REMIND_STATE") {
  chrome.runtime.sendMessage({ type: "GET_PAGES_BRIDGE_STATE" }, (response) => {
    if (chrome.runtime.lastError || !response?.success) {
      postToPage(origin, "REBEL_REMIND_ERROR", requestId, {
        message: chrome.runtime.lastError?.message || "Failed to load extension state",
      });
      return;
    }

    postToPage(origin, responseType, requestId, response.payload);
  });
}

window.addEventListener("message", (event) => {
  if (event.source !== window || !isAllowedOrigin(event.origin)) {
    return;
  }

  const message = event.data || {};
  if (message.app !== SITE_APP) {
    return;
  }

  if (message.type === "REBEL_REMIND_PING") {
    postToPage(event.origin, "REBEL_REMIND_PONG", message.requestId);
    return;
  }

  if (message.type === "REBEL_REMIND_REQUEST_STATE") {
    requestBridgeState(event.origin, message.requestId);
  }
});

chrome.storage.onChanged.addListener((changes, areaName) => {
  if (!["sync", "local"].includes(areaName)) {
    return;
  }

  const relevantKeys = areaName === "sync"
    ? ["user", "preferences", "backgroundColor", "textColor", "selectedThemeKey"]
    : ["userEvents", "Canvas_Assignments", "filteredIC", "savedUNLVEvents", "googleCalendarEvents", "colorList"];

  if (!Object.keys(changes).some((key) => relevantKeys.includes(key))) {
    return;
  }

  if (isAllowedOrigin(window.location.origin)) {
    requestBridgeState(window.location.origin, null, "REBEL_REMIND_STORAGE_UPDATE");
  }
});
