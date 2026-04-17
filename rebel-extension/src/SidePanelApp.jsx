import "./SidePanelApp.css";
import AccordionMenu from "./components/AccordionMenu";
import CalendarView from "./components/CalendarView";
import { useState } from "react";
import { useEffect } from "react"

/**
 * Side Panel UI Layout for the Chrome Extension.
 */
function SidePanelApp() {
  const [activeTab, setActiveTab] = useState("home");

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
      </div>

      {activeTab === "home" ? (
        <section className="sidepanel-card sidepanel-card--browse">
          <div className="sidepanel-card-header">
            <p className="sidepanel-card-eyebrow">Browse</p>
            <h2 className="sidepanel-card-title">Everything in one place.</h2>
          </div>
          <AccordionMenu containerHeight={650} className="sidepanel-accordion-menu" />
        </section>
      ) : (
        <section className="sidepanel-card sidepanel-card--calendar">
          <CalendarView />
        </section>
      )}
    </div>
  );
}

export default SidePanelApp;
