/**
 * Script for Handling Google Calendar API Requests
 *
 * This script contains functions that get a Google authentication token and use it to sync Rebel Remind events to a Google Calendar on the user's account.
 * It does not contain event listeners, as they are managed in background.js.
 *
 * Authored by: Gunnar Dalton
 */

/**
 * Get the token from Google for Google Calendar access.
 */
export function getGoogleToken(interactive = false) {
    return new Promise((resolve) => {
        chrome.identity.getAuthToken({ interactive }, (token) => {
            if (chrome.runtime.lastError) {
                console.log("Error getting token", chrome.runtime.lastError.message || chrome.runtime.lastError);
                resolve(false);
            }
            else {
                resolve(token);
            }
        });
    });
}

export function clearGoogleToken(token) {
    return new Promise((resolve) => {
        if (!token) {
            resolve();
            return;
        }

        chrome.identity.removeCachedAuthToken({ token }, () => resolve());
    });
}

/**
 * Get the calendar ID from storage if one has been stored.
 */
export async function getCalendarID() {
    return new Promise((resolve) => {
        chrome.storage.local.get("GoogleCalendarID", (data) => {
            if (data.GoogleCalendarID) { 
                resolve(data.GoogleCalendarID);
            } else { 
                console.log("No calendar ID in storage.")
                resolve(false);
            }
        });
    });
}

/**
 * Check if the calendar with the specified calendar ID exists on Google.
 */
export async function checkCalendarExists(token, calendarID) {
    const url = `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarID)}`;
    const response = await fetchGoogleCalendar(url, {
        headers: { "Authorization": `Bearer ${token}` }
    });

    if (response.status == 404) {
        console.log("No calendar found.");
        return false;
    }

    await throwIfAuthFailure(response, { calendarID, operation: "checkCalendarExists" });

    if (!response.ok) {
        const errorText = await readResponseText(response);
        logGoogleCalendarFailure("Google Calendar existence check failed", {
            calendarID,
            status: response.status,
            errorText,
        });
        throw new Error(`Google Calendar existence check failed with status ${response.status}`);
    }

    return true;
}

/**
 * Get the calendar ID of the calendar in the account's list or create a new calendar if one is not there.
 */
export async function getOrCreateCalendar(token) {
    let url = "https://www.googleapis.com/calendar/v3/users/me/calendarList";
    const calendarListResponse = await fetchGoogleCalendar(url, {
        headers: { "Authorization": `Bearer ${token}` }
    });

    if (!calendarListResponse.ok) {
        await throwIfAuthFailure(calendarListResponse, { operation: "calendarList" });
        const errorText = await readResponseText(calendarListResponse);
        logGoogleCalendarFailure("Google Calendar list fetch failed", {
            status: calendarListResponse.status,
            errorText,
        });
        throw new Error(`Google Calendar list fetch failed with status ${calendarListResponse.status}`);
    }

    const calendarList = await calendarListResponse.json();

    let foundCalendar = (calendarList.items || []).find(calendar => calendar.summary === "Rebel Remind");
    if (foundCalendar) {
        chrome.storage.local.set({ GoogleCalendarID: foundCalendar.id });
        return foundCalendar.id;
    }
    else {
        url = "https://www.googleapis.com/calendar/v3/calendars";
        const createResponse = await fetchGoogleCalendar(url, {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${token}`,
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                summary: "Rebel Remind",
                timeZone: "America/Los_Angeles"
            })
        });

        if (!createResponse.ok) {
            await throwIfAuthFailure(createResponse, { operation: "createCalendar" });
            const errorText = await readResponseText(createResponse);
            logGoogleCalendarFailure("Google Calendar create failed", {
                status: createResponse.status,
                errorText,
            });
            throw new Error(`Google Calendar create failed with status ${createResponse.status}`);
        }

        const newCalendar = await createResponse.json();
        chrome.storage.local.set({ GoogleCalendarID: newCalendar.id });
        return newCalendar.id;
    }
}

/**
 * Gather all events from storage and format them correctly for Google Calendar.
 */
export async function gatherEvents() {
    // user events, Canvas, filtered Involvement center, saved UNLV events

    const getCanvas = new Promise((resolve) => {
        chrome.storage.local.get("Canvas_Assignments", (data) => {
            if (Array.isArray(data.Canvas_Assignments)) {
                const originalAssignments = data.Canvas_Assignments;
                const newAssignments = originalAssignments.flatMap((assignment) => {
                    if (!assignment?.due_at) {
                        return [];
                    }
                    return [{
                    summary: assignment.title,
                    description: assignment.context_name,
                    id: "assignment" + assignment.id,
                    start: {
                        dateTime: assignment.due_at,
                        timeZone: "America/Los_Angeles"
                    },
                    end: {
                        dateTime: assignment.due_at,
                        timeZone: "America/Los_Angeles"
                    },
                    extendedProperties: {
                        private: {
                            managedBy: "Rebel Remind"
                        }
                    }
                    }];
                });
                resolve(newAssignments);
            }
            else {
                resolve([]);
            }
        });
    });

    
    const getUserEvents = new Promise((resolve) => {
        chrome.storage.local.get("userEvents", (data) => {
            if (data.userEvents) {
                const originalUserEvents = data.userEvents;
                const newUserEvents = originalUserEvents
                    .map(event => buildGoogleCalendarEventPayload({
                        summary: event.title,
                        idPrefix: "userevent",
                        hashTitle: event.title,
                        hashDate: event.startDate,
                        description: event.desc,
                        location: event.location,
                        startDate: event.startDate,
                        startTime: event.startTime,
                        endDate: event.endDate,
                        endTime: event.endTime,
                        allDay: event.allDay,
                    }))
                    .filter(Boolean);
                resolve(newUserEvents);
            }
            else {
                resolve([]);
            }
        });
    });

    const getICEvents = new Promise ((resolve) => {
        chrome.storage.local.get("filteredIC", (data) => {
            if (data.filteredIC) {
                const originalICEvents = data.filteredIC;
                const newICEvents = originalICEvents
                    .map(event => buildGoogleCalendarEventPayload({
                        summary: event.name,
                        idPrefix: "involvementcenter",
                        hashTitle: event.name,
                        hashDate: event.startDate,
                        description: event.organization,
                        location: event.location,
                        startDate: event.startDate,
                        startTime: event.startTime,
                        endDate: event.endDate,
                        endTime: event.endTime,
                    }))
                    .filter(Boolean);
                resolve(newICEvents);
            }
            else {
                resolve([]);
            }
        });
    });

    const getSavedUNLVEvents = new Promise ((resolve) => {
        chrome.storage.local.get("savedUNLVEvents", (data) => {
            if (data.savedUNLVEvents) {
                const originalUNLVEvents = data.savedUNLVEvents;
                const newUNLVEvents = originalUNLVEvents
                    .map(event => buildGoogleCalendarEventPayload({
                        summary: event.name,
                        idPrefix: "unlvevent",
                        hashTitle: event.name,
                        hashDate: event.startDate,
                        description: event.description || event.category || event.organization || event.sport || "",
                        location: event.location,
                        startDate: event.startDate,
                        startTime: event.startTime,
                        endDate: event.endDate,
                        endTime: event.endTime,
                    }))
                    .filter(Boolean);
                resolve(newUNLVEvents);
            }
            else {
                resolve([]);
            }
        });
    });
    const [canvasEvents, userEvents, ICEvents, UNLVEvents] = await Promise.all([getCanvas, getUserEvents, getICEvents, getSavedUNLVEvents]);
    const combined = [...canvasEvents, ...userEvents, ...ICEvents, ...UNLVEvents];
    return combined;
}

function normalizeTimeLabel(value) {
    return String(value || "").trim().toUpperCase().replace(/[\s_-]+/g, " ");
}

function isAllDayTime(value) {
    const normalized = normalizeTimeLabel(value).replace(/[()]/g, "");
    return normalized === "ALL DAY" || normalized === "ALLDAY";
}

function isUnknownTime(value) {
    const normalized = normalizeTimeLabel(value);
    return !normalized || normalized === "TBD" || normalized === "TIME TBD";
}

function parseDateString(dateString) {
    if (!dateString) {
        return null;
    }

    const parsed = new Date(`${dateString}T00:00:00`);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function formatDateForGoogle(date) {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function addDaysToDateString(dateString, days) {
    const parsed = parseDateString(dateString);
    if (!parsed) {
        return dateString;
    }

    parsed.setDate(parsed.getDate() + days);
    return formatDateForGoogle(parsed);
}

function parseDateTimeString(dateString, timeString) {
    if (!dateString || isUnknownTime(timeString) || isAllDayTime(timeString)) {
        return null;
    }

    const parsed = new Date(`${dateString} ${timeString}`);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function parseTimeParts(value) {
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

function isMidnightEndTime(value) {
    const parts = parseTimeParts(value);
    return Boolean(parts && parts.hour === 0 && parts.minute === 0);
}

function resolveMidnightEndDate(startDate, endDate) {
    const parsedStart = parseDateString(startDate);
    const parsedEnd = parseDateString(endDate);
    if (parsedStart && parsedEnd && parsedEnd > parsedStart) {
        return addDaysToDateString(endDate, -1);
    }

    return startDate;
}

function buildGoogleCalendarEventPayload({
    summary,
    idPrefix,
    hashTitle,
    hashDate,
    description = "",
    location = "",
    startDate,
    startTime = "",
    endDate = "",
    endTime = "",
    allDay = false,
}) {
    if (!summary || !startDate) {
        return null;
    }

    const shouldUseAllDay = Boolean(allDay) || isAllDayTime(startTime) || isUnknownTime(startTime);
    const baseEvent = {
        summary,
        id: `${idPrefix}${eventHash(hashTitle || summary, hashDate || startDate)}`,
        status: "confirmed",
        location,
        extendedProperties: {
            private: {
                managedBy: "Rebel Remind"
            }
        }
    };

    if (description) {
        baseEvent.description = description;
    }

    if (shouldUseAllDay) {
        const inclusiveEndDate = endDate || startDate;
        return {
            ...baseEvent,
            start: { date: startDate },
            end: { date: addDaysToDateString(inclusiveEndDate, 1) },
        };
    }

    const startDateTime = parseDateTimeString(startDate, startTime);
    if (!startDateTime) {
        return {
            ...baseEvent,
            start: { date: startDate },
            end: { date: addDaysToDateString(endDate || startDate, 1) },
        };
    }

    const parsedEndDate = endDate || startDate;
    let endDateTime = parseDateTimeString(parsedEndDate, endTime);
    if (isMidnightEndTime(endTime)) {
        endDateTime = parseDateTimeString(resolveMidnightEndDate(startDate, parsedEndDate), "11:59 PM");
    } else if (endDateTime && endDateTime <= startDateTime && endTime) {
        const rolloverEndDateTime = new Date(endDateTime);
        rolloverEndDateTime.setDate(rolloverEndDateTime.getDate() + 1);
        if (rolloverEndDateTime > startDateTime) {
            endDateTime = rolloverEndDateTime;
        }
    }

    if (!endDateTime || endDateTime <= startDateTime) {
        endDateTime = new Date(startDateTime.getTime() + (60 * 60 * 1000));
    }

    return {
        ...baseEvent,
        start: {
            dateTime: startDateTime.toISOString(),
            timeZone: "America/Los_Angeles"
        },
        end: {
            dateTime: endDateTime.toISOString(),
            timeZone: "America/Los_Angeles"
        },
    };
}

function buildCalendarEventsUrl(calendarID) {
    return `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarID)}/events`;
}

function buildCalendarEventUrl(calendarID, eventID) {
    return `${buildCalendarEventsUrl(calendarID)}/${encodeURIComponent(eventID)}`;
}

const GOOGLE_CALENDAR_RETRY_DELAYS_MS = [300, 1200];
const GOOGLE_CALENDAR_RETRY_STATUSES = new Set([408, 429, 500, 502, 503, 504]);

function logGoogleCalendarFailure(message, details) {
    try {
        console.error(`${message}: ${JSON.stringify(details)}`);
    } catch (_error) {
        console.error(message, details);
    }
}

function createGoogleCalendarAuthError(message, details = {}) {
    const error = new Error(message);
    error.googleCalendarAuthError = true;
    error.details = details;
    return error;
}

export function isGoogleCalendarAuthError(error) {
    return Boolean(error?.googleCalendarAuthError);
}

async function throwIfAuthFailure(response, details = {}) {
    if (response?.status !== 401) {
        return;
    }

    const errorText = await readResponseText(response);
    logGoogleCalendarFailure("Google Calendar authentication failed", {
        ...details,
        status: response.status,
        errorText,
    });
    throw createGoogleCalendarAuthError("Google Calendar token was rejected by Google.", {
        ...details,
        status: response.status,
        errorText,
    });
}

async function readResponseText(response) {
    if (!response || typeof response.text !== "function") {
        return "";
    }

    try {
        return await response.text();
    } catch (_error) {
        return "";
    }
}

function wait(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

function buildGoogleCalendarRequest(token, method, event) {
    return {
        method,
        headers: {
            "Authorization": `Bearer ${token}`,
            "Content-Type": "application/json"
        },
        body: JSON.stringify(event)
    };
}

function stableStringify(value) {
    if (Array.isArray(value)) {
        return `[${value.map(stableStringify).join(",")}]`;
    }

    if (value && typeof value === "object") {
        return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stableStringify(value[key])}`).join(",")}}`;
    }

    return JSON.stringify(value);
}

function getEventPrivateProperties(event) {
    return event?.extendedProperties?.private || {};
}

function buildEventSyncHash(event) {
    const privateProperties = { ...getEventPrivateProperties(event) };
    delete privateProperties.rebelRemindSyncHash;

    const eventForHash = {
        ...event,
        extendedProperties: {
            ...(event.extendedProperties || {}),
            private: privateProperties,
        },
    };

    return String(eventHash(stableStringify(eventForHash), event.id || ""));
}

function prepareCalendarEvent(event) {
    const privateProperties = {
        managedBy: "Rebel Remind",
        ...getEventPrivateProperties(event),
    };

    const eventWithManagedBy = {
        ...event,
        status: event.status || "confirmed",
        extendedProperties: {
            ...(event.extendedProperties || {}),
            private: privateProperties,
        },
    };

    return {
        ...eventWithManagedBy,
        extendedProperties: {
            ...eventWithManagedBy.extendedProperties,
            private: {
                ...privateProperties,
                rebelRemindSyncHash: buildEventSyncHash(eventWithManagedBy),
            },
        },
    };
}

function existingEventMatches(existingEvent, event) {
    if (existingEvent?.status === "cancelled") {
        return false;
    }

    return getEventPrivateProperties(existingEvent).rebelRemindSyncHash === getEventPrivateProperties(event).rebelRemindSyncHash;
}

async function fetchGoogleCalendar(url, options) {
    let lastError = null;

    for (let attempt = 0; attempt <= GOOGLE_CALENDAR_RETRY_DELAYS_MS.length; attempt += 1) {
        try {
            const response = await fetch(url, options);
            if (!GOOGLE_CALENDAR_RETRY_STATUSES.has(response.status) || attempt === GOOGLE_CALENDAR_RETRY_DELAYS_MS.length) {
                return response;
            }
        } catch (error) {
            lastError = error;
            if (attempt === GOOGLE_CALENDAR_RETRY_DELAYS_MS.length) {
                throw error;
            }
        }

        await wait(GOOGLE_CALENDAR_RETRY_DELAYS_MS[attempt]);
    }

    throw lastError || new Error("Google Calendar request failed");
}

async function writeCalendarEvent(token, calendarID, event, method, url) {
    const request = buildGoogleCalendarRequest(token, method, event);
    try {
        return await fetchGoogleCalendar(url, request);
    } catch (error) {
        error.googleCalendarNetworkDetails = {
            calendarID,
            eventID: event?.id,
            method,
            url,
            requestBodyLength: request.body?.length || 0,
            requestSummary: event?.summary || "",
            requestStart: event?.start || null,
            requestEnd: event?.end || null,
        };
        throw error;
    }
}

/**
 * Generate a hash based on the title and date of an event for use in the ID field.
 */
// ai-gen start (ChatGPT-4o, 1)
export function eventHash(title, date) {
    const preHashString = `${title}-${date}`;
    let hash = 0;
    for (let i = 0; i < preHashString.length; i++) {
        hash = (hash << 5) - hash + preHashString.charCodeAt(i);
        hash |= 0;
    }
    return Math.abs(hash);
}
// ai-gen end

/**
 * Add or update events in the Google Calendar.
 */
export async function addOrUpdateEvents(token, calendarID, event, existingEventIDs = new Set()) {
    const eventExists = existingEventIDs.has(event.id);
    const createUrl = buildCalendarEventsUrl(calendarID);
    const updateUrl = buildCalendarEventUrl(calendarID, event.id);
    const primaryUrl = eventExists ? updateUrl : createUrl;
    const primaryMethod = eventExists ? "PATCH" : "POST";

    const updateExistingEvent = async (preferredMethod = "PATCH") => {
        const updateMethods = preferredMethod === "PUT" ? ["PUT"] : ["PATCH", "PUT"];
        let lastResponse = null;
        let lastError = null;

        for (const method of updateMethods) {
            try {
                const response = await writeCalendarEvent(token, calendarID, event, method, updateUrl);

                if (response.ok) {
                    return response;
                }

                await throwIfAuthFailure(response, {
                    calendarID,
                    eventID: event.id,
                    method,
                    operation: "writeEvent",
                });

                lastResponse = response;

                if (response.status === 404) {
                    const createResponse = await writeCalendarEvent(token, calendarID, event, "POST", createUrl);
                    await throwIfAuthFailure(createResponse, {
                        calendarID,
                        eventID: event.id,
                        method: "POST",
                        operation: "recreateEvent",
                    });
                    return createResponse;
                }

                if (method === "PATCH" && [400, 405].includes(response.status)) {
                    continue;
                }

                break;
            } catch (error) {
                lastError = error;
                if (isGoogleCalendarAuthError(error)) {
                    throw error;
                }
                if (method === "PATCH") {
                    continue;
                }
                throw error;
            }
        }

        if (lastResponse) {
            return lastResponse;
        }

        throw lastError || new Error("Google Calendar update failed");
    };

    try {
        const response = eventExists
            ? await updateExistingEvent()
            : await writeCalendarEvent(token, calendarID, event, "POST", primaryUrl);

        if (response.ok) {
            return response;
        }

        await throwIfAuthFailure(response, {
            calendarID,
            eventID: event.id,
            method: primaryMethod,
            operation: "writeEvent",
        });

        if (response.status === 409 && !eventExists) {
            const updateResponse = await updateExistingEvent();

            if (!updateResponse.ok) {
                await throwIfAuthFailure(updateResponse, {
                    calendarID,
                    eventID: event.id,
                    method: "PATCH",
                    operation: "resolveConflict",
                });
                const errorText = await readResponseText(updateResponse);
                logGoogleCalendarFailure("Google Calendar update failed", {
                    calendarID,
                    eventID: event.id,
                    status: updateResponse.status,
                    errorText,
                });
            }

            return updateResponse;
        }

        const errorText = await readResponseText(response);
        logGoogleCalendarFailure(`Google Calendar ${primaryMethod === "PATCH" ? "update" : "create"} failed`, {
            calendarID,
            eventID: event.id,
            method: primaryMethod,
            status: response.status,
            errorText,
        });
        return response;
    } catch (error) {
        if (isGoogleCalendarAuthError(error)) {
            throw error;
        }

        logGoogleCalendarFailure("Google Calendar addOrUpdateEvents failed", {
            calendarID,
            eventID: event.id,
            method: primaryMethod,
            errorName: error?.name || "",
            error: error?.message || String(error),
            networkDetails: error?.googleCalendarNetworkDetails || null,
        });
        return null;
    }
}

/**
 * Get the list of events currently in the calendar.
 */
export async function getExistingEvents(token, calendarID) {
    const events = [];
    let pageToken = "";

    do {
        const pageTokenParam = pageToken ? `&pageToken=${encodeURIComponent(pageToken)}` : "";
        const url = `${buildCalendarEventsUrl(calendarID)}?maxResults=2500&showDeleted=true${pageTokenParam}`;
        const response = await fetchGoogleCalendar(url, {
            method: "GET",
            headers: {
                "Authorization": `Bearer ${token}`
            }
        });

        if (!response.ok) {
            await throwIfAuthFailure(response, { calendarID, operation: "getExistingEvents" });
            const errorText = await readResponseText(response);
            logGoogleCalendarFailure("Google Calendar existing events fetch failed", {
                calendarID,
                status: response.status,
                errorText,
            });
            throw new Error(`Google Calendar existing events fetch failed with status ${response.status}`);
        }

        const list = await response.json();
        const items = Array.isArray(list?.items) ? list.items : [];
        events.push(...items.filter(event =>
            event.extendedProperties?.private?.managedBy === "Rebel Remind"
        ));
        pageToken = list?.nextPageToken || "";
    } while (pageToken);

    return events;
}

function formatGoogleCalendarStorageDate(date) {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function formatGoogleCalendarStorageTime(date) {
    return `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
}

function normalizeGoogleCalendarEvent(item) {
    if (!item?.start) {
        return null;
    }

    if (item.start.date) {
        const startDate = new Date(`${item.start.date}T00:00:00`);
        if (Number.isNaN(startDate.getTime())) {
            return null;
        }

        const exclusiveEndDate = item.end?.date ? new Date(`${item.end.date}T00:00:00`) : new Date(startDate);
        const inclusiveEndDate = new Date(exclusiveEndDate);
        inclusiveEndDate.setDate(inclusiveEndDate.getDate() - 1);

        return {
            title: item.summary || "Untitled Google Event",
            startDate: formatGoogleCalendarStorageDate(startDate),
            endDate: formatGoogleCalendarStorageDate(inclusiveEndDate),
            startTime: "(ALL DAY)",
            endTime: "",
            allDay: true,
            location: item.location || "",
            desc: item.description || "",
            link: item.htmlLink || "",
            googleEventId: item.id || "",
        };
    }

    if (item.start.dateTime) {
        const startDateTime = new Date(item.start.dateTime);
        const endDateTime = item.end?.dateTime ? new Date(item.end.dateTime) : new Date(startDateTime);
        if (Number.isNaN(startDateTime.getTime()) || Number.isNaN(endDateTime.getTime())) {
            return null;
        }

        return {
            title: item.summary || "Untitled Google Event",
            startDate: formatGoogleCalendarStorageDate(startDateTime),
            endDate: formatGoogleCalendarStorageDate(endDateTime),
            startTime: formatGoogleCalendarStorageTime(startDateTime),
            endTime: formatGoogleCalendarStorageTime(endDateTime),
            allDay: false,
            location: item.location || "",
            desc: item.description || "",
            link: item.htmlLink || "",
            googleEventId: item.id || "",
        };
    }

    return null;
}

export async function importGoogleCalendarEvents(token) {
    const timeMin = new Date();
    timeMin.setDate(timeMin.getDate() - 1);
    timeMin.setHours(0, 0, 0, 0);
    const url = `https://www.googleapis.com/calendar/v3/calendars/primary/events?maxResults=2500&singleEvents=true&orderBy=startTime&timeMin=${encodeURIComponent(timeMin.toISOString())}`;
    const response = await fetchGoogleCalendar(url, {
        method: "GET",
        headers: {
            "Authorization": `Bearer ${token}`
        }
    });

    if (!response.ok) {
        await throwIfAuthFailure(response, { operation: "importGoogleCalendarEvents" });
        const errorText = await readResponseText(response);
        logGoogleCalendarFailure("Google Calendar import failed", {
            status: response.status,
            errorText,
        });
        return [];
    }

    const payload = await response.json();
    const items = Array.isArray(payload?.items) ? payload.items : [];
    const importedEvents = items
        .filter((event) => event.status !== "cancelled")
        .filter((event) => event.extendedProperties?.private?.managedBy !== "Rebel Remind")
        .map(normalizeGoogleCalendarEvent)
        .filter(Boolean);

    await new Promise((resolve) => {
        chrome.storage.local.set({ googleCalendarEvents: importedEvents }, () => resolve());
    });

    return importedEvents;
}

/**
 * Delete any event from the calendar that is no longer found in Rebel Remind.
 */
export async function deleteEvent(token, calendarID, eventID) {
    let url = buildCalendarEventUrl(calendarID, eventID)
    const response = await fetchGoogleCalendar(url, {
        method: "DELETE",
        headers: {
            "Authorization": `Bearer ${token}`
        }
    });
    if (!response.ok && response.status !== 404 && response.status !== 410) {
        await throwIfAuthFailure(response, { calendarID, eventID, operation: "deleteEvent" });
        const errorText = await readResponseText(response);
        logGoogleCalendarFailure("Google Calendar delete failed", {
            calendarID,
            eventID,
            status: response.status,
            errorText,
        });
    }
    return response;
}

/**
 * Make calls to other functions to fully sync Rebel Remind with Google Calendar.
 */
export async function syncCalendar(events, token, calendarID) {
    const existingEvents = await getExistingEvents(token, calendarID);
    const existingEventMap = new Map(existingEvents.map((event) => [event.id, event]));
    const existingEventIDs = new Set(existingEventMap.keys());
    const preparedEvents = events.map(prepareCalendarEvent);
    const failedEvents = [];
    let deletedCount = 0;
    let skippedCount = 0;
    let writtenCount = 0;
    // ai-gen start (ChatGPT-4o, 1)
    const currentEventIDs = new Set(preparedEvents.map(e => e.id));
    for (const existingEvent of existingEvents) {
        if (!currentEventIDs.has(existingEvent.id)) {
            const deleteResponse = await deleteEvent(token, calendarID, existingEvent.id);
            if (deleteResponse?.ok || deleteResponse?.status === 404 || deleteResponse?.status === 410) {
                deletedCount += 1;
            } else {
                failedEvents.push({ id: existingEvent.id, action: "delete", status: deleteResponse?.status || "network" });
            }
        }
    }
    // ai-gen end
    for (const event of preparedEvents) {
        const existingEvent = existingEventMap.get(event.id);
        if (existingEvent && existingEventMatches(existingEvent, event)) {
            skippedCount += 1;
            continue;
        }

        const response = await addOrUpdateEvents(token, calendarID, event, existingEventIDs);
        if (response?.ok) {
            writtenCount += 1;
        } else {
            failedEvents.push({ id: event.id, action: existingEventIDs.has(event.id) ? "update" : "create", status: response?.status || "network" });
        }
    }

    const result = {
        total: preparedEvents.length,
        written: writtenCount,
        skipped: skippedCount,
        deleted: deletedCount,
        failed: failedEvents.length,
        failedEvents,
    };

    if (failedEvents.length) {
        const error = new Error(`Google Calendar sync incomplete: ${failedEvents.length} event write(s) failed.`);
        error.syncResult = result;
        throw error;
    }

    return result;
}
