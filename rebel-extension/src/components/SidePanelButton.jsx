import { useEffect, useState, useRef } from "react";

/**
 * Side Panel Button Component - Opens Rebel Remind side panel
 * Uses Chrome Messaging API to communicate with the background script.
 *
 * Features:
 * - Opens a different component of the chrome extension
 *
 * Authored by: Billy Estrada
 *
 * Put into component SidePanelButton.jsx by: Billy Estrada
 *
 * @returns {JSX.Element} The SidePanelButton component UI.
 */
function SidePanelButton({ label = "Open Sidebar", className = "" }) {
  const handleOpenSidePanel = () => {
    chrome.runtime.sendMessage({ type: "OPEN_SIDEPANEL" });
    window.close();
  };

  return (
    <div className={className}>
      <button onClick={handleOpenSidePanel}>
        {label}
      </button>
    </div>
  );
}

export default SidePanelButton;
