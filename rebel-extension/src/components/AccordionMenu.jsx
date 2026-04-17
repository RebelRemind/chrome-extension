import { useEffect, useState, useRef } from "react";
import { subscribeToUserEvents, normalizeGoogleCalendarEvents, normalizeSavedUNLVEvents, normalizeUserEvents } from "../../public/scripts/fetch-events.js";
import { filterEvents } from "../../public/scripts/filter-events";
import UserEventPopup from "./UserEventPopup";

import Accordion from 'react-bootstrap/Accordion';
import CanvasAssignments from "./CanvasAssignments";
import 'bootstrap/dist/css/bootstrap.min.css';
import Events from "./Events";
import Toggle from "./Toggle";

import canvasIcon from "../assets/canvas.png";
import unlvIcon from "../assets/UNLVIcon.png";
import calIcon from "../assets/calIcon.png";
/**
 * AccordionMenu.jsx
 *
 * This component renders the main collapsible menu for the Rebel Remind popup UI.
 * It uses React Bootstrap's Accordion to show three dynamic sections:
 *  - 📚 Upcoming Assignments (Canvas assignments)
 *  - 📅 Your Events (saved UNLV events, Involvement Center, and custom user events)
 *  - 🎉 UNLV Events (Union, Academic, and Rec Center events)
 *
 * Features:
 * ✅ Dynamically loads and filters events from remote APIs and Chrome storage
 * ✅ Persists open/closed accordion state via chrome.storage.sync
 * ✅ Syncs view mode ("daily" or "weekly") across popup reloads
 * ✅ Supports user-created events with live updates and modal details
 * ✅ Automatically resizes open panels to evenly split height
 * ✅ Stores filtered events for notification use
 *
 * Subcomponents:
 * - CanvasAssignments.jsx – Loads Canvas tasks from API
 * - Events.jsx – Renders a list of passed events
 * - Toggle.jsx – Switches between daily/weekly modes
 * - UserEventPopup.jsx – Displays event details in a modal when clicked
 *
 * Originally Authored by: Jeremy Besitula
 * 
 * Edited by the rest of team in subsequent PR's
 * 
 * @returns {JSX.Element} The AccordionMenu component UI.
 */
const SECTION_CONFIG = {
  canvas: {
    key: "canvas",
    label: "Upcoming Assignments",
    icon: canvasIcon,
    iconAlt: "canvasIcon",
    iconStyle: { height: "20px", marginRight: "8px" },
  },
  yourEvents: {
    key: "yourEvents",
    label: "Your Events",
    icon: calIcon,
    iconAlt: "calIcon",
    iconStyle: { height: "20px", marginRight: "8px" },
  },
  unlvEvents: {
    key: "unlvEvents",
    label: "UNLV Events",
    icon: unlvIcon,
    iconAlt: "unlvIcon",
    iconStyle: { marginLeft: "-6px", height: "20px" },
  },
};

function AccordionMenu({
  sections = ["canvas", "yourEvents", "unlvEvents"],
  containerHeight = 470,
  className = "",
}) {
  const [filteredAC, setFilteredAcEvents] = useState([]);
  const [filteredIC, setFilteredIcEvents] = useState([]);
  const [filteredRC, setFilteredRcEvents] = useState([]);
  const [filteredUC, setFilteredUcEvents] = useState([]);

  const [user_events, setUserEvents] = useState([]);
  const [normalizedUserEvents, setNormUserEvents] = useState([]);
  const [savedCampusEvents, setSavedCampusEvents] = useState([]);
  const [normalizedSavedCampusEvents, setNormalizedSavedCampusEvents] = useState([]);
  const [googleCalendarEvents, setGoogleCalendarEvents] = useState([]);
  const [normalizedGoogleCalendarEvents, setNormalizedGoogleCalendarEvents] = useState([]);
  const [activeEventPopup, setActiveEventPopup] = useState(null);
  const popupRef = useRef(null);

  const [viewMode, setViewMode] = useState("daily");
  useEffect(() => {
    chrome.storage.sync.get("viewMode", (result) => {
      if (result.viewMode) {
        setViewMode(result.viewMode); // save state of viewMode
      }
    });
  }, []);

  useEffect(() => {
    chrome.storage.sync.set({ viewMode });
  }, [viewMode]);

/***  LOAD EVENTS and FILTER ***/

  const today = new Date().toLocaleDateString('en-CA');
  useEffect(() => {
    const loadEvents = async () => {
      const [newFilteredAC, newFilteredIC, newFilteredRC, newFilteredUC] = await filterEvents(today, viewMode);
      
      setFilteredAcEvents(newFilteredAC);
      setFilteredIcEvents(newFilteredIC);
      setFilteredRcEvents(newFilteredRC);
      setFilteredUcEvents(newFilteredUC);

      chrome.storage.local.set({
        filteredAC: newFilteredAC,
        filteredIC: newFilteredIC,
        filteredRC: newFilteredRC,
        filteredUC: newFilteredUC,
      });
      chrome.runtime.sendMessage({ type: "EVENT_UPDATED" });
    };
      

    loadEvents();
  }, [viewMode, today]);

/***  END LOAD and FILTER EVENTS  ***/

/***  USER EVENTS  ***/

    useEffect(() => {
      const unsubscribe = subscribeToUserEvents(setUserEvents);
      return unsubscribe;
    }, []);

    useEffect(() => {
      const loadSavedCampusEvents = () => {
        chrome.storage.local.get(["savedUNLVEvents", "googleCalendarEvents"], (data) => {
          setSavedCampusEvents(Array.isArray(data.savedUNLVEvents) ? data.savedUNLVEvents : []);
          setGoogleCalendarEvents(Array.isArray(data.googleCalendarEvents) ? data.googleCalendarEvents : []);
        });
      };

      loadSavedCampusEvents();

      const handleMessage = (message) => {
        if (message.type === "EVENT_UPDATED" || message.type === "EVENT_CREATED" || message.type === "GOOGLE_CALENDAR_UPDATED") {
          loadSavedCampusEvents();
        }
      };

      chrome.runtime.onMessage.addListener(handleMessage);
      return () => chrome.runtime.onMessage.removeListener(handleMessage);
    }, []);

    // filter User Events by daily or weekly (brought back, was overwritten)
    function filterUserEvents(events, viewMode) {
      const today = new Date();
      const todayStr = today.toLocaleDateString('en-CA'); // always returns YYYY-MM-DD in local time

      const weekDates = [];
      for (let i = 0; i < 7; i++) {
        const tempDate = new Date(today);
        tempDate.setDate(today.getDate() + i);
        weekDates.push(tempDate.toLocaleDateString('en-CA')); // <- FIXED
      }

      return events.filter(event => {
        if (viewMode === "daily") {
          return event.startDate === todayStr;
        } else if (viewMode === "weekly") {
          return weekDates.includes(event.startDate);
        }
        return false;
      });
    }    

    useEffect(() => {
      const normalized = normalizeUserEvents(user_events);
      const filtered = filterUserEvents(normalized, viewMode);
      setNormUserEvents(filtered);
    }, [user_events, viewMode]);

    useEffect(() => {
      const normalized = normalizeSavedUNLVEvents(savedCampusEvents);
      const filtered = filterUserEvents(normalized, viewMode);
      setNormalizedSavedCampusEvents(filtered);
    }, [savedCampusEvents, viewMode]);

    useEffect(() => {
      const normalized = normalizeGoogleCalendarEvents(googleCalendarEvents);
      const filtered = filterUserEvents(normalized, viewMode);
      setNormalizedGoogleCalendarEvents(filtered);
    }, [googleCalendarEvents, viewMode]);

    // if user event is clicked
    useEffect(() => {
      const handleClickOutside = (e) => {
        if (popupRef.current && !popupRef.current.contains(e.target)) {
          setActiveEventPopup(null);
        }
      };
      document.addEventListener("mousedown", handleClickOutside);
      return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

/***  END USER EVENTS  ***/

/***  DYNAMIC MENU SIZING  ***/

    const [openKeys, setOpenKeys] = useState([]);
    const [isAccordionReady, setIsAccordionReady] = useState(false);

    const storageKey = `openKeys:${sections.join("-")}`;

    useEffect(() => {
      chrome.storage.sync.get(storageKey, (result) => {
        const storedOpenKeys = result[storageKey];
        if (storedOpenKeys) {
          setOpenKeys(storedOpenKeys.filter((key) => sections.includes(key)));
        } else {
          setOpenKeys(sections);
        }
        setIsAccordionReady(true); // signal ready
      });
    }, [storageKey, sections]);

    const toggleKey = (key) => {
      const newKeys = openKeys.includes(key)
        ? openKeys.filter(k => k !== key)
        : [...openKeys, key];

      setOpenKeys(newKeys);
      chrome.storage.sync.set({ [storageKey]: newKeys });
    };

    const isOpen = (key) => openKeys.includes(key);

    // Dynamically determine height per open item
    const totalHeight = Math.max(220, containerHeight - 5);
    const headerHeight = 52;
    const openCount = openKeys.length;
    const bodyHeight = openCount > 0 ? (totalHeight - (sections.length * headerHeight)) / openCount : 0;

/***  END DYNAMIC MENU SIZING  ***/

  return (
    <div className={className}>
      <div className="accordion-header" style={{
        paddingTop: "0.4rem",
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        marginBottom: "0.5rem",
        paddingRight: "1rem",
      }}>
        <p className="accordion-text" style={{ color: "white", margin: 0, fontSize: "1rem", fontWeight: 600 }}>
          Your {viewMode === "daily" ? "Day" : "Week"} at a Glance!
        </p>
        <Toggle
          isChecked={viewMode === "weekly"}
          onChange={() => setViewMode(prev => (prev === "daily" ? "weekly" : "daily"))}
        />
      </div>
      <div className="accordion-wrapper" style={{ height: `${containerHeight}px` }}>
        {isAccordionReady && (
          <Accordion activeKey={openKeys} alwaysOpen className="accordion">
            {sections.map((sectionKey) => {
              const isSectionOpen = isOpen(sectionKey);
              const itemFlexGrow = isSectionOpen ? 1 : 0;
              const section = SECTION_CONFIG[sectionKey];

              return (
                <Accordion.Item
                  eventKey={section.key}
                  key={section.key}
                  className="accordion-item"
                  style={{ flexGrow: itemFlexGrow }}
                >
                <Accordion.Header onClick={() => toggleKey(section.key)}>
                  {section && (
                    <>
                      <img 
                        src={section.icon}
                        alt={section.iconAlt}
                        style={section.iconStyle}
                      />
                      {section.label}
                    </>
                  )}
                </Accordion.Header>
                  <Accordion.Body
                    className="accordion-body"
                    style={{
                      display: isSectionOpen ? "block" : "none",
                      height: `${bodyHeight}px`, // height not maxHeight to ensure equal distribution
                      maxHeight: `${bodyHeight}px`,
                      overflowY: "auto",
                      overflowX: "hidden",
                      minHeight: 0,
                    }}
                  >
                    {sectionKey === "canvas" && <CanvasAssignments viewMode={viewMode} />}
                    {sectionKey === "yourEvents" && <Events events={[...filteredIC, ...normalizedSavedCampusEvents, ...normalizedGoogleCalendarEvents, ...normalizedUserEvents]} viewMode={viewMode} setActiveEventPopup={setActiveEventPopup} yourEvents={true}/>}
                    {sectionKey === "unlvEvents" && <Events events={[
                      ...(Array.isArray(filteredUC) ? filteredUC : []),
                      ...(Array.isArray(filteredAC) ? filteredAC.map(event => ({ ...event, academicCalendar: true })) : []),
                      ...(Array.isArray(filteredRC) ? filteredRC : [])
                    ]} viewMode={viewMode} />}

                  </Accordion.Body>
                </Accordion.Item>
              );
            })}
          </Accordion>
        )}

        {/* 💬 Popup for Custom Event */}
        {activeEventPopup && (
          <UserEventPopup
          event={activeEventPopup}
          onClose={() => setActiveEventPopup(null)}
          popupRef={popupRef}
          />
        )}
      </div>

    </div>
  );
}

export default AccordionMenu;
