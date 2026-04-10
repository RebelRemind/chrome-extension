import { buildDataUrl, DATA_FILES } from "./data-source.js";

function safeDate(dateString) {
  if (!dateString) {
    return null;
  }

  const parsed = new Date(`${dateString}T00:00:00`);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function filterEventsByView(events, today, viewMode) {
  const startDate = safeDate(today);
  if (!startDate) {
    return [];
  }

  const endDate = new Date(startDate);
  endDate.setDate(startDate.getDate() + (viewMode === "weekly" ? 7 : 1));

  return (Array.isArray(events) ? events : []).filter((event) => {
    const eventDate = safeDate(event.startDate);
    if (!eventDate) {
      return false;
    }

    return eventDate >= startDate && eventDate < endDate;
  });
}

export async function fetchEvents(today, viewMode="daily") {
  try {
    const [res1, res2, res3, res4] = await Promise.all([
      fetch(buildDataUrl(DATA_FILES.academicCalendar)),
      fetch(buildDataUrl(DATA_FILES.involvementCenter)),
      fetch(buildDataUrl(DATA_FILES.rebelCoverage)),
      fetch(buildDataUrl(DATA_FILES.unlvCalendar))
    ]);

    if (![res1, res2, res3, res4].every((response) => response.ok)) {
      throw new Error("One or more static event files could not be loaded");
    }

    const [data1, data2, data3, data4] = await Promise.all([
      res1.json(), res2.json(), res3.json(), res4.json()
    ]);

    return [
      filterEventsByView(data1, today, viewMode),
      filterEventsByView(data2, today, viewMode),
      filterEventsByView(data3, today, viewMode),
      filterEventsByView(data4, today, viewMode),
    ];
  } catch (err) {
    console.error('Error fetching events:', err);
    return [null, null, null, null];
  }
}

  /**
     * Loads all user-defined events from Chrome local storage on mount,
     * and subscribes to runtime messages for real-time syncing.
  */
  
export function subscribeToUserEvents(setUserEvents) {
  const loadEvents = () => {
    chrome.storage.local.get("userEvents", (data) => {
      if (Array.isArray(data["userEvents"])) {
        setUserEvents(data["userEvents"]);
      }
    });
  };

  loadEvents();

  const handleMessage = (message) => {
    if (message.type === "EVENT_CREATED") {
      console.log("🔁 Reloading from background after event update...");
      loadEvents();
    }
  };

  chrome.runtime.onMessage.addListener(handleMessage);

  return () => {
    chrome.runtime.onMessage.removeListener(handleMessage);
  };
}

// helper function
function formatTime(timeStr) {
  if (!timeStr || timeStr.trim() === "") return "Time TBD";
  const [hour, minute] = timeStr.split(":").map(Number);
  const ampm = hour >= 12 ? "PM" : "AM";
  const hour12 = hour % 12 === 0 ? 12 : hour % 12;
  return `${hour12}:${minute.toString().padStart(2, "0")} ${ampm}`;
}

export function normalizeUserEvents(userEvents) {
  return userEvents.map((event) => ({
    id: -1,
    name: event.title || "Untitled Event",
    organization: "Your Event",
    time: event.allDay ? "(ALL DAY)" : formatTime(event.startTime),
    startDate: event.startDate,
    link: "customEvent",

    // Full metadata for popup
    allDay: event.allDay,
    startTime: event.startTime,
    endTime: event.endTime,
    location: event.location,
    desc: event.desc,
  }));
}
