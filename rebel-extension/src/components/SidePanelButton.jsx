import { useState } from "react";

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
function SidePanelButton({ label = "Open Sidebar", className = "", targetTab = "" }) {
  const [error, setError] = useState("");

  const handleOpenSidePanel = () => {
    setError("");

    try {
      const message = targetTab
        ? { type: "OPEN_SIDEPANEL", targetTab }
        : { type: "OPEN_SIDEPANEL" };

      chrome.runtime.sendMessage(message, () => {
        if (chrome.runtime.lastError) {
          setError(chrome.runtime.lastError.message || "Reopen Rebel Remind and try again.");
          return;
        }

        window.close();
      });
    } catch (sendError) {
      setError(
        String(sendError?.message || "").includes("Extension context invalidated")
          ? "Rebel Remind was reloaded. Reopen the extension and try again."
          : sendError?.message || "Reopen Rebel Remind and try again."
      );
    }
  };

  return (
    <div className={className}>
      <button onClick={handleOpenSidePanel}>
        {label}
      </button>
      {error ? <p className="side-panel-button-error">{error}</p> : null}
    </div>
  );
}

export default SidePanelButton;
