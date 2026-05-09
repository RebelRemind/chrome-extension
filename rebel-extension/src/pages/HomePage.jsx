import "./css/HomePage.css";
import AccordionMenu from "../components/AccordionMenu";
import SidePanelButton from "../components/SidePanelButton";

import { useNavigate } from "react-router-dom";
import { useEffect, useState, useRef } from "react";

/**
 * Main UI Layout for the Chrome Extension.
 */
function HomePage() {
  const navigate = useNavigate();
  const [showDropdown, setShowDropdown] = useState(false);
  const [showGoogleAuthModal, setShowGoogleAuthModal] = useState(false);
  const [googleAuthModalError, setGoogleAuthModalError] = useState("");
  const [user, setUser] = useState(null);
  const [googleCalendarEnabled, setGoogleCalendarEnabled] = useState(false);
  const [googleCalendarSyncStatus, setGoogleCalendarSyncStatus] = useState(null);
  const DropdownRef = useRef(null);

  const GOOGLE_AUTH_WARNING_REASONS = new Set([
    "missing_token",
    "token_refresh_failed",
    "invalid_token_after_refresh",
  ]);

  const handleOpenWebsite = () => {
    chrome.tabs.create({ url: "https://rebelremind.github.io" });
    window.close();
  };

  const handleGoogleSignIn = () => {
    setGoogleAuthModalError("");

    try {
      chrome.runtime.sendMessage({ type: "LOGIN" }, (response) => {
        if (chrome.runtime.lastError) {
          setGoogleAuthModalError(chrome.runtime.lastError.message || "Google sign-in could not be opened.");
          return;
        }

        if (response?.success) {
          chrome.storage.sync.set({ user: response.user });
          const checkingStatus = {
            success: null,
            reason: "checking_google_calendar",
            updatedAt: new Date().toISOString(),
          };
          setGoogleCalendarSyncStatus(checkingStatus);
          chrome.storage.local.set({
            GoogleCalendarSyncStatus: checkingStatus,
          });
          try {
            chrome.runtime.sendMessage({ type: "UPDATE_GOOGLE_CALENDAR", force: true }, (syncResponse) => {
              if (chrome.runtime.lastError) {
                setGoogleAuthModalError(chrome.runtime.lastError.message || "Google Calendar sync could not be restarted.");
                return;
              }

              if (!syncResponse?.success) {
                setGoogleAuthModalError(syncResponse?.error || "Google sign-in worked, but Google Calendar sync still needs attention.");
                return;
              }

              setShowGoogleAuthModal(false);
            });
          } catch (syncError) {
            setGoogleAuthModalError(
              String(syncError?.message || "").includes("Extension context invalidated")
                ? "Rebel Remind was reloaded. Reopen the extension and try again."
                : syncError?.message || "Google Calendar sync could not be restarted."
            );
          }
          return;
        }

        setGoogleAuthModalError(response?.error || "Google sign-in did not complete.");
      });
    } catch (sendError) {
      setGoogleAuthModalError(
        String(sendError?.message || "").includes("Extension context invalidated")
          ? "Rebel Remind was reloaded. Reopen the extension and try again."
          : sendError?.message || "Google sign-in could not be opened."
      );
    }
  };

  const handleClickAway = (event) => {
    if (DropdownRef.current && !DropdownRef.current.contains(event.target)) {
      setShowDropdown(false);
    }
  };
  
  //Used to handle clicking away from the dropdown
  useEffect(() => {
    document.addEventListener('mousedown', handleClickAway);
    return () => {
      document.removeEventListener('mousedown', handleClickAway);
    };
  }, []);

  // Resize popup to original size when HomePage loads
  useEffect(() => {
    // Wait a tick to make sure layout is rendered
    setTimeout(() => {
      window.resizeTo(450, 600);
    }, 50);
    chrome.storage.sync.get(["user", "preferences"], (data) => {
      if (data.user) {
        setUser(data.user);
      }
      setGoogleCalendarEnabled(Boolean(data.preferences?.googleCalendar));
    });
    chrome.storage.local.get("GoogleCalendarSyncStatus", (data) => {
      setGoogleCalendarSyncStatus(data.GoogleCalendarSyncStatus || null);
    });
  }, []);

  useEffect(() => {
    const handleStorageChange = (changes, areaName) => {
      if (areaName === "local" && changes.GoogleCalendarSyncStatus) {
        setGoogleCalendarSyncStatus(changes.GoogleCalendarSyncStatus.newValue || null);
      }

      if (areaName === "sync") {
        if (changes.user) {
          setUser(changes.user.newValue || null);
        }

        if (changes.preferences) {
          setGoogleCalendarEnabled(Boolean(changes.preferences.newValue?.googleCalendar));
        }
      }
    };

    chrome.storage.onChanged.addListener(handleStorageChange);
    return () => chrome.storage.onChanged.removeListener(handleStorageChange);
  }, []);

  const shouldShowGoogleAuthWarning = Boolean(
    user
    && googleCalendarEnabled
    && googleCalendarSyncStatus
    && googleCalendarSyncStatus.success === false
    && GOOGLE_AUTH_WARNING_REASONS.has(googleCalendarSyncStatus.reason)
  );

  return (
    <div className="popup-home">
      <div className="banner">
        <img
          src="/images/rebel-remind.png"
          alt="Rebel Remind Logo"
          className="rebel-remind-logo"
          style={{ width: "65%" }}
        />

        {/*Change View Dropdown Floating */}
        <div className="profile-container">
          {/* Ensures user.picture exists */}
          {user ?
            (
              <div className="profile-picture-wrap">
                <img
                  src={user.picture}
                  alt="Profile Picture"
                  width="40px"
                  className="profile-pic"
                  onClick={() => setShowDropdown((prev) => !prev)}
                />
                {shouldShowGoogleAuthWarning ? (
                  <button
                    type="button"
                    className="profile-auth-warning"
                    aria-label="Google Calendar sign-in issue"
                    title="Google Calendar sign-in issue"
                    onClick={(event) => {
                      event.stopPropagation();
                      setShowDropdown(false);
                      setShowGoogleAuthModal(true);
                    }}
                  >
                    !
                  </button>
                ) : null}
              </div>
            )
            :
            (
              <div className="settings-button-container">
                <button
                  className="settings-button"
                  onClick={() => navigate("/settings")}
                >
                  ⚙️
                </button>
              </div>
            )
          }
          {showDropdown && (
            <div className="change-view-dropdown" ref={DropdownRef}>
              <button onClick={() => navigate("/user-events")}>
                Custom Events
              </button>
              <SidePanelButton label="Calendar View" targetTab="calendar" />
              <button onClick={() => navigate("/pomodoro")}>
                Pomodoro
              </button>
              <button onClick={() => navigate("/settings")}>
                Settings
              </button>
            </div>
          )}
        </div>
      </div>
      {showGoogleAuthModal ? (
        <div className="google-auth-modal-backdrop" role="presentation">
          <div className="google-auth-modal" role="dialog" aria-modal="true" aria-labelledby="google-auth-modal-title">
            <h2 id="google-auth-modal-title">Google Calendar needs you to sign in</h2>
            <p>
              You've been signed out. Please re-sign in to your account to ensure Google Calendar sync is working.
            </p>
            {googleAuthModalError ? (
              <p className="google-auth-modal-error">{googleAuthModalError}</p>
            ) : null}
            <div className="google-auth-modal-actions">
              <button type="button" onClick={handleGoogleSignIn}>
                Sign In with Google
              </button>
              <button type="button" className="google-auth-modal-secondary" onClick={() => setShowGoogleAuthModal(false)}>
                Not Now
              </button>
            </div>
          </div>
        </div>
      ) : null}
      <div className="popup-main">
        <AccordionMenu sections={["canvas", "yourEvents"]} containerHeight={405} />
      </div>
      <div className="popup-action-row">
        <div className="popup-action-button">
          <button type="button" onClick={handleOpenWebsite}>
            Visit Website
          </button>
        </div>
        <SidePanelButton label="Open Sidebar" className="popup-action-button" />
      </div>

    </div>
  );
}

export default HomePage;
