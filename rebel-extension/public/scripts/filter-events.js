// filter-events.js
import { fetchEvents } from "./fetch-events";

function getEventStorageKey(event) {
  return [
    String(event?.name || "").trim().toLowerCase(),
    String(event?.startDate || "").trim(),
    String(event?.startTime || "").trim().toLowerCase(),
  ].join("::");
}

export async function filterEvents(today, viewMode) {
  const [ac, ic, rc, uc] = await fetchEvents(today, viewMode);

  return new Promise((resolve) => {
    chrome.storage.sync.get(["selectedSports", "selectedInterests", "preferences", "involvedClubs"], (storageData) => {
      chrome.storage.local.get("removedInvolvementCenterEvents", (localData) => {
        const selectedInterests = storageData.selectedInterests || [];
        const selectedSports = storageData.selectedSports || [];
        const involvedClubs = storageData.involvedClubs || [];
        const preferences = storageData.preferences || {};
        const removedICEventKeys = new Set(Array.isArray(localData.removedInvolvementCenterEvents) ? localData.removedInvolvementCenterEvents : []);
      
        const filteredAC = preferences.academicCalendar ? ac : [];
        const filteredIC = preferences.involvementCenter
          ? Array.isArray(ic) ? ic
            .filter((e) => involvedClubs.includes(e.organization))
            .filter((e) => !removedICEventKeys.has(getEventStorageKey(e))) : []
          : [];
        const filteredRC = preferences.rebelCoverage
        ? Array.isArray(rc) ? rc.filter((e) => selectedSports.includes(e.sport))
        : []
        : [];
        const filteredUC = preferences.UNLVCalendar
          ? Array.isArray(uc) ? uc.filter((e) => selectedInterests.includes(e.category)) : []
          : [];
            
        resolve([filteredAC, filteredIC, filteredRC, filteredUC]);
      });
    });
    
  });
}
