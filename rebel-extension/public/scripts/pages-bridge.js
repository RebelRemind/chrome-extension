const SITE_APP = "rebelremind-site";
const EXTENSION_APP = "rebelremind-extension";
const BRIDGE_EVENT_ACTION_RESULT = "REBEL_REMIND_EVENT_ACTION_RESULT";
const ALLOWED_ORIGINS = new Set([
  "https://rebelremind.github.io",
  "https://rebelremind.com",
  "https://www.rebelremind.github.io",
  "https://www.rebelremind.com",
  "http://localhost:5173",
  "http://127.0.0.1:5173",
  "http://localhost:5174",
  "http://127.0.0.1:5174",
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

function normalizeTextField(value, maxLength = 2000) {
  return String(value || "").trim().slice(0, maxLength);
}

function normalizeCampusEvent(payload) {
  if (!payload || typeof payload !== "object") {
    return null;
  }

  const event = {
    name: normalizeTextField(payload.name || payload.title, 300),
    startDate: normalizeTextField(payload.startDate, 40),
    startTime: normalizeTextField(payload.startTime, 40),
    endDate: normalizeTextField(payload.endDate || payload.startDate, 40),
    endTime: normalizeTextField(payload.endTime, 40),
    location: normalizeTextField(payload.location, 500),
    organization: normalizeTextField(payload.organization, 300),
    category: normalizeTextField(payload.category, 120),
    sport: normalizeTextField(payload.sport, 120),
    description: normalizeTextField(payload.description || payload.summary, 2000),
    imageUrl: normalizeTextField(payload.imageUrl, 1000),
    link: normalizeTextField(payload.link, 1000),
    sourceKey: normalizeTextField(payload.sourceKey, 80),
    sourceLabel: normalizeTextField(payload.sourceLabel, 120),
  };

  if (!event.name || !event.startDate) {
    return null;
  }

  return event;
}

function getSavedCampusEventKey(event) {
  return [
    normalizeTextField(event?.name, 300).toLowerCase(),
    normalizeTextField(event?.startDate, 40),
    normalizeTextField(event?.startTime, 40).toLowerCase(),
  ].join("::");
}

function postEventActionResult(origin, requestId, payload) {
  postToPage(origin, BRIDGE_EVENT_ACTION_RESULT, requestId, payload);
}

function updateSavedCampusEvent(origin, requestId, payload, action) {
  const event = normalizeCampusEvent(payload);
  if (!event) {
    postEventActionResult(origin, requestId, {
      success: false,
      action,
      message: "The selected event is missing a name or start date.",
    });
    return;
  }

  chrome.storage.local.get("savedUNLVEvents", (data) => {
    if (chrome.runtime.lastError) {
      postEventActionResult(origin, requestId, {
        success: false,
        action,
        message: chrome.runtime.lastError.message || "Could not read saved events.",
      });
      return;
    }

    const existing = Array.isArray(data.savedUNLVEvents) ? data.savedUNLVEvents : [];
    const eventKey = getSavedCampusEventKey(event);
    const withoutEvent = existing.filter((item) => getSavedCampusEventKey(item) !== eventKey);
    const updatedEvents = action === "save" ? [...withoutEvent, event] : withoutEvent;

    chrome.storage.local.set({ savedUNLVEvents: updatedEvents }, () => {
      if (chrome.runtime.lastError) {
        postEventActionResult(origin, requestId, {
          success: false,
          action,
          message: chrome.runtime.lastError.message || "Could not update saved events.",
        });
        return;
      }

      chrome.runtime.sendMessage({ type: "EVENT_UPDATED" }, () => {
        if (chrome.runtime.lastError) {
          // The background service worker may already be awake through storage changes.
        }
      });

      postEventActionResult(origin, requestId, {
        success: true,
        action,
        event,
      });
      requestBridgeState(origin, null, "REBEL_REMIND_STORAGE_UPDATE");
    });
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
    return;
  }

  if (message.type === "REBEL_REMIND_SAVE_EVENT") {
    updateSavedCampusEvent(event.origin, message.requestId, message.payload, "save");
    return;
  }

  if (message.type === "REBEL_REMIND_REMOVE_EVENT") {
    updateSavedCampusEvent(event.origin, message.requestId, message.payload, "remove");
  }
});

chrome.storage.onChanged.addListener((changes, areaName) => {
  if (!["sync", "local"].includes(areaName)) {
    return;
  }

  const relevantKeys = areaName === "sync"
    ? ["user", "preferences", "backgroundColor", "textColor", "selectedThemeKey", "involvedClubs", "selectedInterests", "selectedSports"]
    : ["userEvents", "Canvas_Assignments", "filteredIC", "savedUNLVEvents", "googleCalendarEvents", "colorList"];

  if (!Object.keys(changes).some((key) => relevantKeys.includes(key))) {
    return;
  }

  if (isAllowedOrigin(window.location.origin)) {
    requestBridgeState(window.location.origin, null, "REBEL_REMIND_STORAGE_UPDATE");
  }
});
