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

function isExtensionContextInvalidated(error) {
  return String(error?.message || error || "").toLowerCase().includes("extension context invalidated");
}

function handleInvalidatedContext(origin, requestId = null) {
  postToPage(origin, "REBEL_REMIND_ERROR", requestId, {
    message: "Rebel Remind was reloaded. Refresh this page to reconnect the extension.",
    reason: "extension_context_invalidated",
  });
}

function safeRuntimeSendMessage(origin, requestId, message, callback) {
  try {
    if (!chrome?.runtime?.id) {
      handleInvalidatedContext(origin, requestId);
      return false;
    }

    chrome.runtime.sendMessage(message, callback);
    return true;
  } catch (error) {
    if (isExtensionContextInvalidated(error)) {
      handleInvalidatedContext(origin, requestId);
      return false;
    }

    throw error;
  }
}

function safeStorageGet(origin, requestId, area, keys, callback) {
  try {
    chrome.storage[area].get(keys, callback);
    return true;
  } catch (error) {
    if (isExtensionContextInvalidated(error)) {
      handleInvalidatedContext(origin, requestId);
      return false;
    }

    throw error;
  }
}

function safeStorageSet(origin, requestId, area, value, callback) {
  try {
    chrome.storage[area].set(value, callback);
    return true;
  } catch (error) {
    if (isExtensionContextInvalidated(error)) {
      handleInvalidatedContext(origin, requestId);
      return false;
    }

    throw error;
  }
}

function requestBridgeState(origin, requestId = null, responseType = "REBEL_REMIND_STATE", attempt = 0) {
  if (!isAllowedOrigin(origin)) {
    return;
  }

  safeRuntimeSendMessage(origin, requestId, { type: "GET_PAGES_BRIDGE_STATE" }, (response) => {
    const messageError = chrome.runtime.lastError;
    if (messageError && attempt < 2) {
      window.setTimeout(() => {
        requestBridgeState(origin, requestId, responseType, attempt + 1);
      }, 250 * (attempt + 1));
      return;
    }

    if (messageError || !response?.success) {
      postToPage(origin, "REBEL_REMIND_ERROR", requestId, {
        message: messageError?.message || response?.message || "Failed to load extension state",
      });
      return;
    }

    postToPage(origin, responseType, requestId, response.payload);
  });
}

function normalizeTextField(value, maxLength = 2000) {
  return String(value || "").trim().slice(0, maxLength);
}

function parseBridgeTimeParts(value) {
  const normalized = String(value || "").trim().toUpperCase();
  const twentyFourHourMatch = normalized.match(/^(\d{1,2}):(\d{2})(?::\d{2})?$/);
  if (twentyFourHourMatch) {
    return {
      hour: Number.parseInt(twentyFourHourMatch[1], 10),
      minute: Number.parseInt(twentyFourHourMatch[2], 10),
    };
  }

  const match = normalized.match(/^(\d{1,2})(?::(\d{2}))?\s*([AP]M)$/);
  if (!match) {
    return null;
  }

  let hour = Number.parseInt(match[1], 10);
  const minute = Number.parseInt(match[2] || "0", 10);
  if (hour === 12) {
    hour = 0;
  }
  if (match[3] === "PM") {
    hour += 12;
  }

  return { hour, minute };
}

function isBridgeMidnightEndTime(value) {
  const parts = parseBridgeTimeParts(value);
  return Boolean(parts && parts.hour === 0 && parts.minute === 0);
}

function parseBridgeDateString(value) {
  const match = String(value || "").trim().match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) {
    return null;
  }

  const parsed = new Date(
    Number.parseInt(match[1], 10),
    Number.parseInt(match[2], 10) - 1,
    Number.parseInt(match[3], 10),
    12,
    0,
    0,
    0
  );
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function formatBridgeDate(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function addBridgeDays(dateValue, days) {
  const parsed = parseBridgeDateString(dateValue);
  if (!parsed) {
    return dateValue;
  }

  parsed.setDate(parsed.getDate() + days);
  return formatBridgeDate(parsed);
}

function parseBridgeDateTime(dateValue, timeValue) {
  const parsedDate = parseBridgeDateString(dateValue);
  const timeParts = parseBridgeTimeParts(timeValue);
  if (!parsedDate || !timeParts) {
    return null;
  }

  parsedDate.setHours(timeParts.hour, timeParts.minute, 0, 0);
  return parsedDate;
}

function resolveBridgeMidnightEndDate(startDate, endDate) {
  const parsedStart = parseBridgeDateString(startDate);
  const parsedEnd = parseBridgeDateString(endDate);
  if (parsedStart && parsedEnd && parsedEnd > parsedStart) {
    return addBridgeDays(endDate, -1);
  }

  return startDate;
}

function normalizeCampusEventEnd(event) {
  const isAllDay = event.startTime === "(ALL DAY)";
  if (isAllDay || !event.startDate) {
    return event;
  }

  if (isBridgeMidnightEndTime(event.endTime)) {
    return {
      ...event,
      endDate: resolveBridgeMidnightEndDate(event.startDate, event.endDate || event.startDate),
      endTime: "11:59 PM",
    };
  }

  const startsAt = parseBridgeDateTime(event.startDate, event.startTime);
  const endsAt = parseBridgeDateTime(event.endDate || event.startDate, event.endTime);
  if (startsAt && endsAt && endsAt <= startsAt) {
    return {
      ...event,
      endDate: addBridgeDays(event.endDate || event.startDate, 1),
    };
  }

  return event;
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

  const normalizedEvent = normalizeCampusEventEnd(event);

  if (!normalizedEvent.name || !normalizedEvent.startDate) {
    return null;
  }

  return normalizedEvent;
}

function getSavedCampusEventKey(event) {
  return [
    normalizeTextField(event?.name, 300).toLowerCase(),
    normalizeTextField(event?.startDate, 40),
    normalizeTextField(event?.startTime, 40).toLowerCase(),
  ].join("::");
}

function isInvolvementCenterEvent(event) {
  return event?.sourceKey === "involvementCenter" || event?.sourceLabel === "Involvement Center";
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

  safeStorageGet(origin, requestId, "local", ["savedUNLVEvents", "filteredIC", "removedInvolvementCenterEvents"], (data) => {
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
    const existingFilteredIC = Array.isArray(data.filteredIC) ? data.filteredIC : [];
    const existingRemovedIC = Array.isArray(data.removedInvolvementCenterEvents) ? data.removedInvolvementCenterEvents : [];
    const shouldHideICEvent = action === "remove" && isInvolvementCenterEvent(event);
    const updatedFilteredIC = shouldHideICEvent
      ? existingFilteredIC.filter((item) => getSavedCampusEventKey(item) !== eventKey)
      : existingFilteredIC;
    const updatedRemovedIC = shouldHideICEvent && !existingRemovedIC.includes(eventKey)
      ? [...existingRemovedIC, eventKey]
      : existingRemovedIC;

    const storageUpdate = { savedUNLVEvents: updatedEvents };
    if (shouldHideICEvent) {
      storageUpdate.filteredIC = updatedFilteredIC;
      storageUpdate.removedInvolvementCenterEvents = updatedRemovedIC;
    }

    safeStorageSet(origin, requestId, "local", storageUpdate, () => {
      if (chrome.runtime.lastError) {
        postEventActionResult(origin, requestId, {
          success: false,
          action,
          message: chrome.runtime.lastError.message || "Could not update saved events.",
        });
        return;
      }

      safeRuntimeSendMessage(origin, requestId, { type: "EVENT_UPDATED" }, () => {
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

try {
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
} catch (error) {
  if (!isExtensionContextInvalidated(error)) {
    throw error;
  }
}
