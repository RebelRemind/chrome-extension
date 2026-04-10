import React, { useEffect, useState, useRef } from "react";
import CanvasTokenManager from "../components/CanvasTokenManager.jsx";
import { FaQuestionCircle } from 'react-icons/fa';
import NotificationToggle from "../components/NotificationToggle";
import { buildDataUrl, DATA_FILES } from "../../public/scripts/data-source.js";

/**
 * Preferences Component
 *
 * This UI allows users to customize their preferences such as calendars, clubs, sports, and interests.
 * Preferences are synced with Chrome Storage and UI adjusts based on the user's selections.
 * Tooltips (help icons) offer descriptions for each preference.
 * 
 * Props:
 * - setupMode (boolean): if true, shows setup mode-specific (welcome page) behavior and visuals.
 * 
 * Authored by: Sebastian Yepez
 * Documentation updated by ChatGPT
 * 
 * @component
 * @returns {JSX.Element} The full Preferences management UI.
 */
const Preferences = ({ setupMode = false }) => {

    // =================== STATIC CONFIGURATION ===================

    // Main preferences shown as checkboxes
    const preferencesList = [
        { key: "academicCalendar", label: "Academic Calendar" },
        { key: "UNLVCalendar", label: "UNLV Calendar" },
        { key: "involvementCenter", label: "Involvement Center" },
        { key: "canvasIntegration", label: "Canvas Integration" },
        { key: "rebelCoverage", label: "Rebel Sports" },
        { key: "googleCalendar", label: "Google Calendar" },
    ];

    // Tooltip descriptions for each preference
    const preferenceDescriptions = {
        academicCalendar: "Shows important academic deadlines such as start/end dates, holidays, and exam periods.",
        UNLVCalendar: "Displays general campus-wide events including performances, guest lectures, and social activities.",
        involvementCenter: "Enables club and organization filters. Select the ones you’re involved in to get updates.",
        canvasIntegration: "Connects your Canvas account so you can view assignments and deadlines inside the extension.",
        rebelCoverage: "Lets you choose Rebel men’s and women’s sports to follow for scores, news, and games.",
        googleCalendar: "Lets you connect to your Google Calendar account and show all of your saved events.",
    };

    // =================== STATE VARIABLES ===================

    // Controls which tooltip (if any) is open
    const [activeHelp, setActiveHelp] = useState(null);

    // Search filter for clubs
    const [searchTerm, setSearchTerm] = useState("");

    // User-selected clubs
    const [involvedClubs, setInvolvedClubs] = useState([]);

    // Clubs from remote API
    const [allClubs, setAllClubs] = useState([]);

    // Sports and interests state
    const allSports = ["Baseball", "Football", "Softball", "Swimming & Diving", "Men's Basketball", "Men's Golf", "Men's Soccer", "Men's Tennis", "Women's Basketball", "Women's Cross Country", "Women's Golf", "Women's Soccer", "Women's Tennis", "Women's Track & Field", "Women's Volleyball"];
    const allInterests = ["Arts", "Academics", "Career", "Culture", "Diversity", "Health", "Social", "Sports", "Tech", "Community"];
    const [selectedSports, setSelectedSports] = useState([]);
    const [selectedInterests, setSelectedInterests] = useState([]);

    // Toggles for showing collapsible sections
    const [showClubs, setShowClubs] = useState(true);
    const [showSports, setShowSports] = useState(true);
    const [showInterests, setShowInterests] = useState(true);

    // Master object that tracks all preference checkboxes
    const defaultPreferences = {
        academicCalendar: false,
        UNLVCalendar: false,
        involvementCenter: false,
        canvasIntegration: false,
        rebelCoverage: false,
        googleCalendar: false,
    };
    const [notifications, setNotifications] = useState(false);
    const [initialNotifications, setInitialNotifications] = useState(false);


    const [preferences, setPreferences] = useState(defaultPreferences);

    // Flags for tracking load state and unsaved changes
    const [loaded, setLoaded] = useState(false);
    const [unsaved, setUnsaved] = useState(false);

    // Initial values for change detection
    const [initialPreferences, setInitialPreferences] = useState({});
    const [initialClubs, setInitialClubs] = useState([]);
    const [initialSports, setInitialSports] = useState([]);
    const [initialInterests, setInitialInterests] = useState([]);

    // =================== EFFECT: Fetch all clubs from API ===================

    useEffect(() => {
        fetch(buildDataUrl(DATA_FILES.organizations))
            .then((response) => {
                if (!response.ok) throw new Error("Network response was not ok");
                return response.json();
            })
            .then((data) => {
                // Extract and store just the names of the clubs
                const clubNames = data.map(club => club.name);
                setAllClubs(clubNames);
            })
            .catch((error) => {
                console.error("Failed to fetch clubs:", error);
            });
    }, []);

    // =================== EFFECT: Load user preferences from Chrome Storage ===================

    useEffect(() => {
        chrome.storage.sync.get([
            "preferences",
            "notificationsEnabled",
            "involvedClubs",
            "selectedSports",
            "selectedInterests"
        ], (data) => {
            setPreferences(data.preferences || defaultPreferences);
            setInitialPreferences(data.preferences || defaultPreferences);

            setNotifications(data.notificationsEnabled || false);
            setInitialNotifications(data.notificationsEnabled || false);

            setInvolvedClubs(data.involvedClubs || []);
            setInitialClubs(data.involvedClubs || []);

            setSelectedSports(data.selectedSports || []);
            setInitialSports(data.selectedSports || []);

            setSelectedInterests(data.selectedInterests || []);
            setInitialInterests(data.selectedInterests || []);

            setLoaded(true);
        });
    }, []);

    // =================== EFFECT: Track if unsaved changes exist ===================

    useEffect(() => {
        if (!loaded) return;
        const hasChanges =
            JSON.stringify(preferences) !== JSON.stringify(initialPreferences) ||
            JSON.stringify(involvedClubs) !== JSON.stringify(initialClubs) ||
            JSON.stringify(selectedSports) !== JSON.stringify(initialSports) ||
            JSON.stringify(selectedInterests) !== JSON.stringify(initialInterests) ||
            JSON.stringify(notifications) !== JSON.stringify(initialNotifications);

        setUnsaved(hasChanges);
    }, [loaded, notifications, preferences, involvedClubs, selectedSports, selectedInterests]);

    // =================== EFFECT: Close help popups on outside click ===================

    const popupRefs = useRef({});
    useEffect(() => {
        const handleMouseDown = (event) => {
            if (!activeHelp) return;

            const iconClicked = event.target.closest(".help-icon");
            const popup = popupRefs.current[activeHelp];

            // Use timeout to allow internal click logic to finish first
            setTimeout(() => {
                if (iconClicked?.dataset.key === activeHelp) return;
                if (popup && popup.contains(event.target)) return;

                setActiveHelp(null);
            }, 0);
        };

        window.addEventListener("mousedown", handleMouseDown);
        return () => window.removeEventListener("mousedown", handleMouseDown);
    }, [activeHelp]);

    // =================== HANDLERS ===================

    // Toggle a preference checkbox
    const handlePreferenceChange = (key) => {
        setPreferences((prev) => ({
            ...prev,
            [key]: !prev[key],
        }));
    };


    /**
     * Save current preferences and selections to Chrome Storage.
     * Also updates the initial values so "unsaved" doesn't show.
     * Requests for Canvas assignments to be updated in storage and an alarm to be started if Canvas integration is enabled.
     * Stops alarm for refreshing Canvas assignments if Canvas integration is disabled.
     */
    const savePreferences = () => {
        chrome.storage.sync.set(
            {
                preferences,
                notificationsEnabled: notifications,
                involvedClubs,
                selectedSports,
                selectedInterests,
            },
            () => {
                setInitialPreferences(preferences);
                setInitialNotifications(notifications);
                setInitialClubs(involvedClubs);
                setInitialSports(selectedSports);
                setInitialInterests(selectedInterests);
                setUnsaved(false);
                alert("Preferences saved!");
            }
        );
        if (preferences.canvasIntegration) { // Checks Canvas integration preference
            chrome.storage.local.get("canvasPAT", (data) => {
                if (data.canvasPAT) {
                    chrome.runtime.sendMessage({ type: "UPDATE_ASSIGNMENTS" }); // Get assignments if Canvas Access Token is present
                    chrome.runtime.sendMessage({ type: "START_CANVAS_ALARM" }); // Start alarm to trigger future fetches
                }
                else {
                    alert("Please enter a Canvas Access Token!"); // Tell users they need an access token to use Canvas integration
                }
            });
        }
        else {
            chrome.runtime.sendMessage({ type: "CLEAR_CANVAS_ALARM" }); // Stops Canvas alarm if integration is shut off
        }
    };

    // Toggle sports
    const toggleSport = (sport) => {
        setSelectedSports((prev) =>
            prev.includes(sport) ? prev.filter((s) => s !== sport) : [...prev, sport]
        );
    };

    // Filter clubs from remote list (excluding already joined)
    const filteredClubs = allClubs
        .filter(club => !involvedClubs.includes(club))
        .filter(club => club.toLowerCase().includes(searchTerm.toLowerCase()))
        .slice(0, 8);

    const handleAddClub = (club) => {
        if (!involvedClubs.includes(club)) {
            setInvolvedClubs(prev => [...prev, club]);
        }
    };
    const handleRemoveClub = (club) => {
        setInvolvedClubs(prev => prev.filter(c => c !== club));
    };

    // Used in setup mode to scroll user to a section
    const preferenceRefs = useRef({});
    const highlightPreference = (key) => {
        const el = preferenceRefs.current[key];
        if (el) {
            el.classList.add("highlight-flash");
            setTimeout(() => el.classList.remove("highlight-flash"), 1000);
            el.scrollIntoView({ behavior: "smooth", block: "center" });
        }
    };

    // =================== RENDER ===================
    const splitIndex = allSports.indexOf("Women's Basketball");
    const leftSports = allSports.slice(0, splitIndex);
    const rightSports = allSports.slice(splitIndex);

    return (
        <>
            {!setupMode ?
                <div style={{ padding: '0.2rem' }}>
                    {/* Preferences Grid */}
                    <div>
                        <NotificationToggle
                            enabled={notifications}
                            setEnabled={setNotifications}
                            style={{ marginBottom: '1rem' }}
                        />
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', columnGap: '1rem', paddingTop: '1rem' }}>
                            {/* Left column preferences */}

                            <div style={{ display: 'flex', flexDirection: 'column', rowGap: '1rem' }}>
                                {preferencesList.slice(0, 3).map(({ key, label }) => (
                                    <label key={key} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                        <input type="checkbox" checked={preferences[key]} onChange={() => handlePreferenceChange(key)} />
                                        {label}
                                    </label>
                                ))}
                            </div>
                            {/* Right column preferences */}
                            <div style={{ display: 'flex', flexDirection: 'column', rowGap: '1rem' }}>
                                {preferencesList.slice(3).map(({ key, label }) => (
                                    <label key={key} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                        <input type="checkbox" checked={preferences[key]} onChange={() => handlePreferenceChange(key)} />
                                        {label}
                                    </label>
                                ))}
                            </div>
                        </div>
                    </div>

                    {/* Interests Section */}
                    {preferences.UNLVCalendar && (
                        <div style={{ marginTop: "2rem" }}>
                            <div onClick={() => setShowInterests(prev => !prev)} style={{ display: 'flex', justifyContent: 'space-between', cursor: 'pointer' }}>
                                <span style={{ fontWeight: "bold" }}>Your Interests</span>
                                <span>{showInterests ? "▲" : "▼"}</span>
                            </div>
                            {showInterests && (
                                <div style={{ marginTop: "1rem", display: "flex", flexWrap: "wrap", gap: "0.5rem", justifyContent: "space-evenly" }}>
                                    {allInterests.map((interest) => (
                                        <label key={interest} style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                                            <input
                                                type="checkbox"
                                                checked={selectedInterests.includes(interest)}
                                                onChange={() =>
                                                    setSelectedInterests((prev) =>
                                                        prev.includes(interest)
                                                            ? prev.filter((i) => i !== interest)
                                                            : [...prev, interest]
                                                    )
                                                }
                                            />
                                            {interest}
                                        </label>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}

                    {/* Club Selector */}
                    {preferences.involvementCenter && (
                        <div style={{ marginTop: "1rem" }}>
                            <div onClick={() => setShowClubs(prev => !prev)} style={{ display: 'flex', justifyContent: 'space-between', cursor: 'pointer' }}>
                                <span style={{ fontWeight: "bold" }}>Your Organizations</span>
                                <span>{showClubs ? "▲" : "▼"}</span>
                            </div>
                            {showClubs && (
                                <div style={{ marginTop: "1rem" }}>
                                    <input
                                        type="text"
                                        placeholder="Search for orgs..."
                                        value={searchTerm}
                                        onChange={(e) => setSearchTerm(e.target.value)}
                                        style={{ padding: '0.5rem', width: '100%', marginBottom: '1rem' }}
                                    />
                                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                                        {filteredClubs.map((club) => (
                                            <button key={club} onClick={() => handleAddClub(club)} style={{
                                                padding: '0.3rem 0.6rem',
                                                borderRadius: '9999px', background: '#555'
                                            }}>
                                                {club}
                                            </button>
                                        ))}
                                    </div>
                                    <div style={{ marginTop: '1rem', display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                                        {involvedClubs.map((club) => (
                                            <div key={club} style={{
                                                color: 'white', display: 'flex', alignItems: 'center',
                                                background: '#8b0000', borderRadius: '9999px', padding: '0.3rem', fontSize: '0.9rem'
                                            }}>
                                                <span style={{ padding: '0.3rem' }}>{club}</span>
                                                <button onClick={() => handleRemoveClub(club)} style={{
                                                    background: 'none', border: 'none',
                                                    fontWeight: 'bold', cursor: 'pointer'
                                                }} aria-label={`Remove ${club}`}>
                                                    ×
                                                </button>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    )}

                    {/* Sports Selector */}
                    {preferences.rebelCoverage && (
                        <div style={{ marginTop: "1rem" }}>
                            <div onClick={() => setShowSports(prev => !prev)} style={{ display: 'flex', justifyContent: 'space-between', cursor: 'pointer' }}>
                                <span style={{ fontWeight: "bold" }}>Rebel Sports Coverage</span>
                                <span>{showSports ? "▲" : "▼"}</span>
                            </div>
                            {showSports && (
                                <div style={{ display: "flex", justifyContent: "center" }}>
                                    <div style={{ fontSize: "13px", width: "100%", display: "grid", gridTemplateColumns: "1fr 1fr", columnGap: "0.01rem", marginTop: "0.5rem" }}>
                                        <div>
                                            {leftSports.map((sport) => (
                                                <label key={sport} style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginTop: "0.5rem" }}>
                                                    <input
                                                        type="checkbox"
                                                        checked={selectedSports.includes(sport)}
                                                        onChange={() => toggleSport(sport)}
                                                    />
                                                    {sport}
                                                </label>
                                            ))}
                                        </div>
                                        <div>
                                            {rightSports.map((sport) => (
                                                <label key={sport} style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginTop: "0.5rem" }}>
                                                    <input
                                                        type="checkbox"
                                                        checked={selectedSports.includes(sport)}
                                                        onChange={() => toggleSport(sport)}
                                                    />
                                                    {sport}
                                                </label>
                                            ))}
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}

                    {/* Action Buttons */}
                    <div className="mt-3" style={{ display: "flex", justifyContent: "space-around" }}>
                        <button className="rounded" onClick={() => {
                            const confirmReset = window.confirm("Are you sure you want to reset all your preferences?");
                            if (!confirmReset) return;

                            chrome.storage.sync.remove([
                                "preferences", "involvedClubs", "selectedSports", "selectedInterests"
                            ], () => {
                                setPreferences(defaultPreferences);
                                setInvolvedClubs([]);
                                setSelectedSports([]);
                                setSelectedInterests([]);

                                setInitialPreferences(defaultPreferences);
                                setInitialClubs([]);
                                setInitialSports([]);
                                setInitialInterests([]);

                                setUnsaved(false);
                            });
                        }}>
                            Reset Preferences
                        </button>
                        <button className="rounded" onClick={savePreferences}>Save Preferences</button>
                    </div>

                    {/* Unsaved Changes Notification */}
                    {unsaved && (
                        <div style={{ marginTop: '1rem', color: 'crimson', fontSize: '0.9rem' }}>
                            You have unsaved changes!
                        </div>
                    )}
                </div>
                :

                /***  SETUP PREFERENCES PAGE ***/

                <div style={{ padding: '0.2rem', width: '100%' }}>
                    {/* Preferences Grid */}
                    <div>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', columnGap: '1.5rem', width: '21rem', margin: 'auto' }}>
                            {/* Left column preferences */}
                            <div style={{ display: 'flex', flexDirection: 'column', rowGap: '1rem' }}>
                                {preferencesList.slice(0, 3).map(({ key, label }) => (
                                    <div key={key} style={{ position: 'relative' }}>
                                        <div style={{
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'space-between', // push label and icon apart
                                            gap: '0.5rem'
                                        }}>
                                            {/* Checkbox and label */}
                                            <label
                                                ref={(el) => (preferenceRefs.current[key] = el)}
                                                style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', margin: 0 }}
                                            >
                                                <input
                                                    type="checkbox"
                                                    checked={preferences[key]}
                                                    onChange={() => handlePreferenceChange(key)}
                                                />
                                                {label}
                                            </label>

                                            {/* Help icon on the far right */}
                                            <FaQuestionCircle
                                                className="help-icon"
                                                data-key={key}
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    setActiveHelp(activeHelp === key ? null : key);
                                                }}
                                                title="What is this?"
                                                style={{
                                                    cursor: "pointer",
                                                    color: "#007bff",
                                                    fontSize: "0.8rem",
                                                    flexShrink: 0,
                                                }}
                                            />
                                        </div>

                                        {/* Tooltip / Popup */}
                                        {activeHelp === key && (
                                            <div
                                                ref={(el) => (popupRefs.current[key] = el)}
                                                style={{
                                                    position: "absolute",
                                                    top: "100%",
                                                    left: "0",
                                                    zIndex: 10,
                                                    marginTop: "0.3rem",
                                                    background: "white",
                                                    padding: "0.5rem",
                                                    border: "1px solid #ccc",
                                                    borderRadius: "6px",
                                                    boxShadow: "0 2px 6px rgba(0,0,0,0.2)",
                                                    width: "250px"
                                                }}
                                            >
                                                <p style={{ margin: 0, fontSize: "0.85rem" }}>{preferenceDescriptions[key]}</p>
                                                <button
                                                    onClick={() => setActiveHelp(null)}
                                                    style={{
                                                        marginTop: "0.3rem",
                                                        background: "transparent",
                                                        border: "none",
                                                        color: "#007bff",
                                                        fontSize: "0.8rem",
                                                        cursor: "pointer",
                                                        padding: 0,
                                                    }}
                                                >
                                                    Close
                                                </button>
                                            </div>
                                        )}
                                    </div>

                                ))}
                            </div>

                            {/* Right column preferences */}
                            <div style={{ display: 'flex', flexDirection: 'column', rowGap: '1rem' }}>
                                {preferencesList.slice(3).map(({ key, label }) => (
                                    <div key={key} style={{ position: 'relative' }}>
                                        <div style={{
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'space-between',
                                            gap: '0.5rem'
                                        }}>
                                            {/* Checkbox and label */}
                                            <label
                                                ref={(el) => (preferenceRefs.current[key] = el)}
                                                style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', margin: 0 }}
                                            >
                                                <input
                                                    type="checkbox"
                                                    checked={preferences[key]}
                                                    onChange={() => handlePreferenceChange(key)}
                                                />
                                                {label}
                                            </label>

                                            {/* Help icon on the far right */}
                                            <FaQuestionCircle
                                                className="help-icon"
                                                data-key={key}
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    setActiveHelp(activeHelp === key ? null : key);
                                                }}
                                                title="What is this?"
                                                style={{
                                                    cursor: "pointer",
                                                    color: "#007bff",
                                                    fontSize: "0.8rem",
                                                    flexShrink: 0,
                                                }}
                                            />
                                        </div>

                                        {/* Tooltip / Popup */}
                                        {activeHelp === key && (
                                            <div
                                                ref={(el) => (popupRefs.current[key] = el)}
                                                style={{
                                                    position: "absolute",
                                                    top: "100%",
                                                    left: "0",
                                                    zIndex: 10,
                                                    marginTop: "0.3rem",
                                                    background: "white",
                                                    padding: "0.5rem",
                                                    border: "1px solid #ccc",
                                                    borderRadius: "6px",
                                                    boxShadow: "0 2px 6px rgba(0,0,0,0.2)",
                                                    width: "250px"
                                                }}
                                            >
                                                <p style={{ margin: 0, fontSize: "0.85rem" }}>{preferenceDescriptions[key]}</p>
                                                <button
                                                    onClick={() => setActiveHelp(null)}
                                                    style={{
                                                        marginTop: "0.3rem",
                                                        background: "transparent",
                                                        border: "none",
                                                        color: "#007bff",
                                                        fontSize: "0.8rem",
                                                        cursor: "pointer",
                                                        padding: 0,
                                                    }}
                                                >
                                                    Close
                                                </button>
                                            </div>
                                        )}
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>

                    {/* Interests Section */}
                    <div onClick={() => {
                        if (!preferences.UNLVCalendar) {
                            highlightPreference("UNLVCalendar");
                        }
                    }}
                    >
                        <div style={{
                            marginTop: "2rem",
                            opacity: preferences.UNLVCalendar ? 1 : 0.5,
                            pointerEvents: preferences.UNLVCalendar ? "auto" : "none",
                        }}
                        >
                            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                <span style={{ fontWeight: "bold", fontSize: "1rem" }}>Your Interests</span>
                            </div>
                            <div style={{ marginTop: "1rem", display: "flex", flexWrap: "wrap", gap: "0.5rem", justifyContent: "space-evenly" }}>
                                {allInterests.map((interest) => (
                                    <label key={interest} style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                                        <input
                                            type="checkbox"
                                            checked={selectedInterests.includes(interest)}
                                            onChange={() =>
                                                setSelectedInterests((prev) =>
                                                    prev.includes(interest)
                                                        ? prev.filter((i) => i !== interest)
                                                        : [...prev, interest]
                                                )
                                            }
                                        />
                                        {interest}
                                    </label>
                                ))}
                            </div>
                        </div>
                    </div>

                    {/* Club Selector */}
                    <div onClick={() => {
                        if (!preferences.involvementCenter) {
                            highlightPreference("involvementCenter");
                        }
                    }}
                    >
                        <div style={{
                            marginTop: "1rem", opacity: preferences.involvementCenter ? 1 : 0.5,
                            pointerEvents: preferences.involvementCenter ? "auto" : "none",
                        }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                <span style={{ fontWeight: "bold", fontSize: "1rem" }}>Your Organizations</span>
                            </div>
                            <div style={{ marginTop: "1rem" }}>
                                <input
                                    type="text"
                                    placeholder="Search for orgs..."
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                    style={{ padding: '0.5rem', width: '90%', marginBottom: '1rem' }}
                                />
                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                                    {filteredClubs.map((club) => (
                                        <button className="PrefClubSelect" key={club} onClick={() => handleAddClub(club)} style={{
                                            padding: '0.3rem 0.6rem',
                                            borderRadius: '9999px', background: '#aaa'
                                        }}>
                                            {club}
                                        </button>
                                    ))}
                                </div>
                                <div style={{ marginTop: '1rem', marginBottom: '1rem', display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                                    {involvedClubs.map((club) => (
                                        <div key={club} style={{
                                            color: 'white', display: 'flex', alignItems: 'center',
                                            background: '#8b0000', borderRadius: '9999px', padding: '0.3rem', fontSize: '0.9rem'
                                        }}>
                                            <span style={{ padding: '0.3rem' }}>{club}</span>
                                            <button onClick={() => handleRemoveClub(club)} style={{
                                                background: 'none', border: 'none',
                                                fontWeight: 'bold', cursor: 'pointer', color: 'white'
                                            }} aria-label={`Remove ${club}`}>
                                                ×
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Sports Selector */}
                    <div onClick={() => {
                        if (!preferences.rebelCoverage) {
                            highlightPreference("rebelCoverage");
                        }
                    }}
                    >
                        <div style={{
                            marginTop: "0.5rem", opacity: preferences.rebelCoverage ? 1 : 0.5,
                            pointerEvents: preferences.rebelCoverage ? "auto" : "none", marginLeft: "auto",
                            marginRight: "auto"
                        }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                <span style={{ fontWeight: "bold", fontSize: "1rem" }}>Rebel Sports Coverage</span>
                            </div>
                            <div style={{display: "flex", justifyContent: "center"}}>
                            <div style={{ width: "50%", alignItems: "center", display: "grid", gridTemplateColumns: "1fr 1fr", columnGap: "1rem", marginTop: "0.5rem" }}>
                                <div>
                                    {leftSports.map((sport) => (
                                        <label key={sport} style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginTop: "0.5rem" }}>
                                            <input
                                                type="checkbox"
                                                checked={selectedSports.includes(sport)}
                                                onChange={() => toggleSport(sport)}
                                            />
                                            {sport}
                                        </label>
                                    ))}
                                </div>
                                <div>
                                    {rightSports.map((sport) => (
                                        <label key={sport} style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginTop: "0.5rem" }}>
                                            <input
                                                type="checkbox"
                                                checked={selectedSports.includes(sport)}
                                                onChange={() => toggleSport(sport)}
                                            />
                                            {sport}
                                        </label>
                                    ))}
                                </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Action Buttons */}
                    <div className="mt-3" style={{ display: "flex", justifyContent: "center", gap: '2rem', marginTop: '2rem' }}>
                        <button className="PrefClearBtn"
                            onClick={() => {
                                const confirmReset = window.confirm("Are you sure you want to reset all your preferences?");
                                if (!confirmReset) return;

                                chrome.storage.sync.remove([
                                    "preferences", "involvedClubs", "selectedSports", "selectedInterests"
                                ], () => {
                                    setPreferences(defaultPreferences);
                                    setInvolvedClubs([]);
                                    setSelectedSports([]);
                                    setSelectedInterests([]);

                                    setInitialPreferences(defaultPreferences);
                                    setInitialClubs([]);
                                    setInitialSports([]);
                                    setInitialInterests([]);

                                    setUnsaved(false);
                                });
                            }}>
                            Clear Preferences
                        </button>
                        <button className="PrefSaveBtn" onClick={savePreferences}>Save Preferences</button>
                    </div>

                    {/* Unsaved Changes Notification */}
                    {unsaved && (
                        <div style={{ marginTop: '1rem', color: 'crimson', fontSize: '0.9rem' }}>
                            You have unsaved changes!
                        </div>
                    )}

                    {/* Canvas PAT Integration */}
                    <div onClick={() => {
                        if (!preferences.canvasIntegration) {
                            highlightPreference("canvasIntegration");
                        }
                    }}
                    >
                        <div style={{
                            marginTop: "1rem", opacity: preferences.canvasIntegration ? 1 : 0.5,
                            pointerEvents: preferences.canvasIntegration ? "auto" : "none", textAlign: "left"
                        }} className="canvas-container">
                            <span style={{ textAlign: "left", fontWeight: "bold", fontSize: "1rem" }}>Canvas Personal Access Token</span>
                            <p>Your Canvas Personal Access Token is stored locally on your browser and used to integrate our app with Canvas!
                                We do not store this token, or any of your personal information externally.
                            </p>
                            <p style={{ fontWeight: "bold" }}>On Canvas, go to Account {">"} Settings {">"} Approved Integrations {">"}  New Access Token {">"}  Enter "Rebel Remind" as the Purpose</p>
                            <p>Copy and paste your token here. Make sure to be wary of the expiration date you set! Be sure to securely save it. If you log out of our app,
                                it will delete your token!
                            </p>
                            <CanvasTokenManager />
                        </div>
                    </div>
                </div >
            }
        </>
    );
};

export default Preferences;
