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
export function getGoogleToken() {
    return new Promise((resolve) => {
        chrome.identity.getAuthToken({ interactive: true }, (token) => {
            if (chrome.runtime.lastError) {
                console.log("Error getting token");
                resolve(false);
            }
            else {
                resolve(token);
            }
        });
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
    const url = `https://www.googleapis.com/calendar/v3/calendars/${calendarID}`;
    const response = await fetch (url, {
        headers: { "Authorization": `Bearer ${token}` }
    });

    if (response.status == 404) {
        console.log("No calendar found.");
        return false;
    }
    return true;
}

/**
 * Get the calendar ID of the calendar in the account's list or create a new calendar if one is not there.
 */
export async function getOrCreateCalendar(token) {
    let url = "https://www.googleapis.com/calendar/v3/users/me/calendarList";
    const calendarListResponse = await fetch (url, {
        headers: { "Authorization": `Bearer ${token}` }
    });
    const calendarList = await calendarListResponse.json();

    let foundCalendar = calendarList.items.find(calendar => calendar.summary === "Rebel Remind");
    if (foundCalendar) {
        chrome.storage.local.set({ GoogleCalendarID: foundCalendar.id });
        return foundCalendar.id;
    }
    else {
        url = "https://www.googleapis.com/calendar/v3/calendars";
        const createResponse = await fetch(url, {
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
            if (data.Canvas_Assignments) {
                const originalAssignments = data.Canvas_Assignments;
                const newAssignments = originalAssignments.flatMap((assignment) => {
                    if (!assignment.due_at) {
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
                const newUserEvents = originalUserEvents.map(event => ({
                    summary: event.title,
                    id: `userevent${eventHash(event.title, event.date)}`,
                    description: event.desc,
                    location: event.location,
                    start: event.allDay ? { date: event.startDate, timeZone: "America/Los_Angeles" } : { dateTime: `${event.startDate}T${event.startTime}:00`, timeZone: "America/Los_Angeles" },
                    end: event.allDay ? { date: event.startDate, timeZone: "America/Los_Angeles" } : { dateTime: `${event.startDate}T${event.endTime}:00`, timeZone: "America/Los_Angeles"},
                    extendedProperties: {
                        private: {
                            managedBy: "Rebel Remind"
                        }
                    }
                }));
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
                const newICEvents = originalICEvents.map(event => ({
                    summary: event.name,
                    id: `involvementcenter${eventHash(event.name, event.startDate)}`,
                    description: event.organization,
                    start: {
                        dateTime: (new Date(`${event.startDate} ${event.startTime}`)).toISOString(),
                        // timeZone: "America/Los_Angeles"
                    },
                    end: {
                        dateTime: (new Date(`${event.endDate} ${event.endTime}`)).toISOString(),
                        // timeZone: "America/Los_Angeles"
                    },
                    location: event.location,
                    extendedProperties: {
                        private: {
                            managedBy: "Rebel Remind"
                        }
                    }
                }));
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
                const newUNLVEvents = originalUNLVEvents.map(event => {
                    return {
                        summary: event.name,
                        id: `unlvevent${eventHash(event.name, event.startDate)}`,
                        start: (event.startTime === "(ALL DAY)") ? { date: event.startDate } : { dateTime: (new Date(`${event.startDate} ${event.startTime}`)).toISOString() },
                        end: (event.endTime === "") ? (event.startTime === "(ALL DAY)") ? { date: event.endDate } : { dateTime: (new Date(`${event.startDate} ${event.startTime}`)).toISOString() } : { dateTime: (new Date(`${event.endDate} ${event.endTime}`)).toISOString() },
                        location: event.location,
                        extendedProperties: {
                        private: {
                            managedBy: "Rebel Remind"
                        }
                    }
                    };
                });
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
export async function addOrUpdateEvents(token, calendarID, event) {
    let url = `https://www.googleapis.com/calendar/v3/calendars/${calendarID}/events?eventId=${event.id}`;
    const response = await fetch(url, {
        method: "POST",
        headers: {
            "Authorization": `Bearer ${token}`,
            "Content-Type": "application/json"
        },
        body: JSON.stringify(event)
    });
    
    if (response.status === 409) {
        let updateurl = `https://www.googleapis.com/calendar/v3/calendars/${calendarID}/events/${event.id}`;
        await fetch (updateurl, {
            method: "PUT",
            headers: {
                "Authorization": `Bearer ${token}`,
                "Content-Type": "application/json"
            },
            body: JSON.stringify(event)
        });
    }
}

/**
 * Get the list of events currently in the calendar.
 */
export async function getExistingEvents(token, calendarID) {
    let url = `https://www.googleapis.com/calendar/v3/calendars/${calendarID}/events?maxResults=2500`;
    const response = await fetch(url, {
        method: "GET",
        headers: {
            "Authorization": `Bearer ${token}`
        }
    });
    const list = await response.json();
    if (list) {
        if (list.items.length) {
            return list.items.filter(event => 
                event.extendedProperties?.private?.managedBy === "Rebel Remind"
            );
        }
        else {
            return [];
        }
    }
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
    const url = `https://www.googleapis.com/calendar/v3/calendars/primary/events?maxResults=2500&singleEvents=true&orderBy=startTime&timeMin=${encodeURIComponent(timeMin.toISOString())}`;
    const response = await fetch(url, {
        method: "GET",
        headers: {
            "Authorization": `Bearer ${token}`
        }
    });

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
    let url = `https://www.googleapis.com/calendar/v3/calendars/${calendarID}/events/${eventID}`
    const response = await fetch(url, {
        method: "DELETE",
        headers: {
            "Authorization": `Bearer ${token}`
        }
    });
}

/**
 * Make calls to other functions to fully sync Rebel Remind with Google Calendar.
 */
export async function syncCalendar(events, token, calendarID) {
    const existingEvents = await getExistingEvents(token, calendarID);
    // ai-gen start (ChatGPT-4o, 1)
    const currentEventIDs = new Set(events.map(e => e.id));
    for (const existingEvent of existingEvents) {
        if (!currentEventIDs.has(existingEvent.id)) {
            await deleteEvent(token, calendarID, existingEvent.id);
        }
    }
    // ai-gen end
    for (const event of events) {
        await addOrUpdateEvents(token, calendarID, event);
    }
}
