import "./SidePanelApp.css";
import AccordionMenu from "./components/AccordionMenu";
import CalendarView from "./components/CalendarView";
import UserEventInput from "./components/UserEventInput";
import UserEventList from "./components/UserEventList";
import { useState } from "react";
import { useEffect } from "react"

const UNLV_CALENDAR_DATASET_URL = "https://rebelremind.github.io/datasets/unlvCalendar";

/**
 * Side Panel UI Layout for the Chrome Extension.
 */
function SidePanelApp() {
  const [activeTab, setActiveTab] = useState("home");

  const handleViewMoreEvents = () => {
    chrome.tabs.create({ url: UNLV_CALENDAR_DATASET_URL });
  };

  useEffect(() => {
    const validTabs = new Set(["home", "calendar", "customEvents"]);
    chrome.storage.local.get("sidePanelActiveTab", (data) => {
      if (validTabs.has(data.sidePanelActiveTab)) {
        setActiveTab(data.sidePanelActiveTab);
        chrome.storage.local.remove("sidePanelActiveTab");
      }
    });

    const handleTabMessage = (message) => {
      if (message.type === "SET_SIDEPANEL_TAB" && validTabs.has(message.targetTab)) {
        setActiveTab(message.targetTab);
      }
    };

    const handleStorageChange = (changes, areaName) => {
      const nextTab = changes.sidePanelActiveTab?.newValue;
      if (areaName === "local" && validTabs.has(nextTab)) {
        setActiveTab(nextTab);
        chrome.storage.local.remove("sidePanelActiveTab");
      }
    };

    chrome.runtime.onMessage.addListener(handleTabMessage);
    chrome.storage.onChanged.addListener(handleStorageChange);
    return () => {
      chrome.runtime.onMessage.removeListener(handleTabMessage);
      chrome.storage.onChanged.removeListener(handleStorageChange);
    };
  }, []);

  useEffect(() => {
    const applyGradient = (baseColor) => {
      const blendHexColor = (color, ratio = 0.5) => {
        if (!color || !color.startsWith("#") || color.length !== 7) {
          return color;
        }

        const clampRatio = Math.max(0, Math.min(1, ratio));
        const red = Number.parseInt(color.slice(1, 3), 16);
        const green = Number.parseInt(color.slice(3, 5), 16);
        const blue = Number.parseInt(color.slice(5, 7), 16);
        const mixChannel = (channel) => Math.round(channel + ((255 - channel) * clampRatio));

        return `#${[mixChannel(red), mixChannel(green), mixChannel(blue)]
          .map((channel) => channel.toString(16).padStart(2, "0"))
          .join("")}`;
      };

      const gradient = `linear-gradient(135deg, ${baseColor}, ${blendHexColor(baseColor, 0.5)})`;
      document.documentElement.style.setProperty("--app-background", gradient);
      document.body.style.background = gradient;
    };
  
    // Initial load
    chrome.storage.sync.get("backgroundColor", (data) => {
      const baseColor = data.backgroundColor || "#dc143c";
      applyGradient(baseColor);
    });
  
    // Listen for updates
    const handleColorUpdate = (msg) => {
      if (msg.type === "COLOR_UPDATED") {
        applyGradient(msg.color);
      }
    };
  
    chrome.runtime.onMessage.addListener(handleColorUpdate);
  
    return () => {
      chrome.runtime.onMessage.removeListener(handleColorUpdate);
    };
  }, []);
  
  

  return (
    <div className="sidepanel-shell">
      <div className="sidepanel-tabbar">
        <button
          type="button"
          className={`sidepanel-tab ${activeTab === "home" ? "is-active" : ""}`}
          onClick={() => setActiveTab("home")}
        >
          Home
        </button>
        <button
          type="button"
          className={`sidepanel-tab ${activeTab === "calendar" ? "is-active" : ""}`}
          onClick={() => setActiveTab("calendar")}
        >
          Calendar
        </button>
        <button
          type="button"
          className={`sidepanel-tab ${activeTab === "customEvents" ? "is-active" : ""}`}
          onClick={() => setActiveTab("customEvents")}
        >
          Custom Events
        </button>
      </div>

      {activeTab === "home" ? (
        <section className="sidepanel-card sidepanel-card--browse">
          <div className="sidepanel-card-header">
            <p className="sidepanel-card-eyebrow">Browse</p>
            <h2 className="sidepanel-card-title">Everything in one place.</h2>
          </div>
          <AccordionMenu containerHeight={650} className="sidepanel-accordion-menu" />
          <div className="sidepanel-view-more-row">
            <button
              type="button"
              className="sidepanel-view-more-button"
              onClick={handleViewMoreEvents}
            >
              View More Events
            </button>
          </div>
        </section>
      ) : activeTab === "calendar" ? (
        <section className="sidepanel-card sidepanel-card--calendar">
          <CalendarView />
          <div className="sidepanel-view-more-row sidepanel-view-more-row--calendar">
            <button
              type="button"
              className="sidepanel-view-more-button"
              onClick={handleViewMoreEvents}
            >
              View More Events
            </button>
          </div>
        </section>
      ) : (
        <section className="sidepanel-card sidepanel-card--custom-events">
          <UserEventInput />
          <UserEventList />
        </section>
      )}
    </div>
  );
}

export default SidePanelApp;
