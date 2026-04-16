import { useEffect, useState } from "react";
import "./css/ColorPicker.css";

function CalendarColorChange() {
    const [colorList, setColorList] = useState({
        UNLVEvents: "#b10202",
        InvolvementCenter: "#666666",
        userEvents: "#0000ff",
        CanvasCourses: {},
    });
    const [involvementCenterPreference, setInvolvementCenterPreference] = useState(false);
    const [UNLVEventsPreference, setUNLVEventsPreference] = useState(false);
    const [CanvasIntegrationPreference, setCanvasIntegrationPreference] = useState(false);
    const [loaded, setLoaded] = useState(false);

    useEffect(() => {
        /**
        * Fetches the color list from storage.
        */
        const getColorList = async() => {
            chrome.storage.local.get("colorList", (data) => {
                setColorList({
                    UNLVEvents: data.colorList?.UNLVEvents || "#b10202",
                    InvolvementCenter: data.colorList?.InvolvementCenter || "#666666",
                    userEvents: data.colorList?.userEvents || "#0000ff",
                    CanvasCourses: data.colorList?.CanvasCourses || {},
                });
                setLoaded(true);
            });
		};

        /**
        * Fetches preferences from storage.
        */
        const getPreferences = async() => {
            chrome.storage.sync.get("preferences", (data) => {
                const preferences = data.preferences || {};
                setInvolvementCenterPreference(Boolean(preferences.involvementCenter));
                setCanvasIntegrationPreference(Boolean(preferences.canvasIntegration));
                if (preferences.UNLVCalendar || preferences.academicCalendar || preferences.rebelCoverage) {
                    setUNLVEventsPreference(true);
                }
            });
        };

        getColorList();
        getPreferences();
    }, []);

    /**
     * Effect Hook: Stores the new color list only after colorList was actually updated
     */
    useEffect(() => {
        if (!loaded) {
            return;
        }

        chrome.storage.local.set({ "colorList": colorList }, () => {
            chrome.runtime.sendMessage({ type: "EVENT_UPDATED" });
        });
    }, [colorList, loaded]);

    /**
    * Update colorList with new color and save the new color to storage. 
    * Alert the calendar that colors have been updated so the calendar immediately updates to change.
    */
    const changeColor = (type, color) => {
        if (type != "InvolvementCenter" && type != "UNLVEvents" && type != "userEvents") {
            setColorList((prevColors) => ({
                ...prevColors,
                CanvasCourses: {
                    ...prevColors.CanvasCourses,
                    [type]: {
                        ...prevColors.CanvasCourses[type],
                        color: color
                    }
                }
            }));
        }
        else {
            setColorList((prevColors) => ({
                ...prevColors,
                [type]: color
            }));
        }
    };

    return (
        <div>
            <h2>Events</h2>
            <div
                style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "1rem" }}
                >
                    <label htmlFor="userEvents" style={{ fontWeight: "bold" }}>
                        Your Created Events:
                    </label>

                    <input
                        id="userEvents"
                        type="color"
                        value={colorList["userEvents"]}
                        onChange={(e) => changeColor("userEvents", e.target.value)}
                        style={{ marginLeft: "1rem" }}
                        className="color-picker-input"
                    /> 
            </div>
            {involvementCenterPreference && (
                <div
                style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "1rem" }}
                >
                    <label htmlFor="involvementCenter" style={{ fontWeight: "bold" }}>
                        Involvement Center:
                    </label>

                    <input
                        id="involvementCenter"
                        type="color"
                        value={colorList["InvolvementCenter"]}
                        onChange={(e) => changeColor("InvolvementCenter", e.target.value)}
                        style={{ marginLeft: "1rem" }}
                        className="color-picker-input"
                    /> 
                </div>
            )}
            {UNLVEventsPreference && (
                <div
                style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "1rem" }}
                >
                    <label htmlFor="UNLVEvents" style={{ fontWeight: "bold" }}>
                        UNLV Events:
                    </label>

                    <input
                        id="UNLVEvents"
                        type="color"
                        value={colorList["UNLVEvents"]}
                        onChange={(e) => changeColor("UNLVEvents", e.target.value)}
                        style={{ marginLeft: "1rem" }}
                        className="color-picker-input"
                    /> 
                </div>
            )}
            {CanvasIntegrationPreference && Object.keys(colorList.CanvasCourses || {}).length > 0 && (
                <div>
                    <br></br>
                    <h2>Canvas Courses</h2>
                    {Object.entries(colorList.CanvasCourses || {}).map(([courseID, courseInfo]) => (
                        <div
                            key={courseID}
                            style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "1rem" }}
                        >
                            <label htmlFor={courseID} style={{ fontWeight: "bold" }}>
                                {courseInfo.name}:
                            </label>

                            <input
                                id={courseID}
                                type="color"
                                value={colorList.CanvasCourses[courseID].color}
                                onChange={(e) => changeColor(courseID, e.target.value)}
                                style={{ marginLeft: "1rem" }}
                                className="color-picker-input"
                            /> 
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}

export default CalendarColorChange;
