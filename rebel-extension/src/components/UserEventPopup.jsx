import React, { useState } from "react";


const formatTime = (timeStr) => {
    if (!timeStr || timeStr.trim() === "") return "Time TBD";
    const [hour, minute] = timeStr.split(":").map(Number);
    const ampm = hour >= 12 ? "PM" : "AM";
    const hour12 = hour % 12 === 0 ? 12 : hour % 12;
    return `${hour12}:${minute.toString().padStart(2, "0")} ${ampm}`;
};

/**
* Safely parses a YYYY-MM-DD string into a local Date object.
*/
const parseDateLocal = (yyyyMmDd) => {
    const [year, month, day] = yyyyMmDd.split("-").map(Number);
    return new Date(year, month - 1, day);
};

/**
 * Converts a date string into a readable format (e.g. March 25, 2025).
*/
const formatDate = (dateString) => {
    if (!dateString) return "";
    const date = parseDateLocal(dateString);
    return date.toLocaleDateString("en-US", {
        year: "numeric",
        month: "long",
        day: "numeric",
    });
};


function UserEventPopup({ event, onClose, onSave, onArchive, popupRef }) {
    const [isEditing, setIsEditing] = useState(false);
    const [draftEvent, setDraftEvent] = useState(() => ({
        title: event?.name || "",
        desc: event?.desc || "",
        startDate: event?.startDate || "",
        startTime: event?.allDay ? "" : event?.startTime || "",
        endTime: event?.allDay ? "" : event?.endTime || "",
        location: event?.location || "",
        allDay: Boolean(event?.allDay),
    }));

    if (!event) return null;

    const handleDraftChange = (field, value) => {
        setDraftEvent((current) => {
            const next = { ...current, [field]: value };
            if (field === "startTime" || field === "endTime") {
                next.allDay = !(next.startTime || next.endTime);
            }
            return next;
        });
    };

    const handleSave = () => {
        const isAllDay = !draftEvent.startTime?.trim() && !draftEvent.endTime?.trim();

        if (!draftEvent.title.trim()) {
            alert("Please enter a valid title.");
            return;
        }

        if (!draftEvent.startDate.trim()) {
            alert("Please enter a date.");
            return;
        }

        if (!isAllDay) {
            if (!draftEvent.startTime.trim() && draftEvent.endTime.trim()) {
                alert("Please enter a start time.");
                return;
            }

            if (!draftEvent.endTime.trim() && draftEvent.startTime.trim()) {
                alert("Please enter an end time.");
                return;
            }
        }

        onSave?.(event, {
            title: draftEvent.title,
            desc: draftEvent.desc,
            startDate: draftEvent.startDate,
            startTime: isAllDay ? "" : draftEvent.startTime,
            endTime: isAllDay ? "" : draftEvent.endTime,
            location: draftEvent.location,
            allDay: isAllDay,
        });
    };

    const actionButtonStyle = {
        marginTop: "0.5rem",
        color: "white",
        border: "none",
        borderRadius: "4px",
        padding: "6px 12px",
        cursor: "pointer",
        fontWeight: "bold"
    };

    return (
        <div
            ref={popupRef}
            style={{
                position: "absolute",
                top: "60%",
                left: "50%",
                transform: "translate(-50%, -50%)",
                zIndex: 9999,
                background: "white",
                padding: "1rem",
                border: "1px solid #ccc",
                borderRadius: "8px",
                boxShadow: "0 4px 12px rgba(0,0,0,0.3)",
                width: "300px",
                maxHeight: "70vh",
                overflowY: "auto",
                color: "black",
            }}
        >
            <h5 style={{ marginTop: 0, marginBottom: "0.5rem" }}>📝 Your Event</h5>
            {isEditing ? (
                <div style={{ display: "grid", gap: "0.55rem" }}>
                    <input
                        type="text"
                        value={draftEvent.title}
                        onChange={(e) => handleDraftChange("title", e.target.value)}
                        placeholder="Event Title"
                    />
                    <textarea
                        value={draftEvent.desc}
                        onChange={(e) => handleDraftChange("desc", e.target.value)}
                        placeholder="Event Description"
                    />
                    <input
                        type="date"
                        value={draftEvent.startDate}
                        onChange={(e) => handleDraftChange("startDate", e.target.value)}
                    />
                    <input
                        type="text"
                        value={draftEvent.location}
                        onChange={(e) => handleDraftChange("location", e.target.value)}
                        placeholder="Location"
                    />
                    <label style={{ display: "grid", gap: "0.25rem", fontWeight: "bold" }}>
                        Start
                        <input
                            type="time"
                            value={draftEvent.startTime}
                            onChange={(e) => handleDraftChange("startTime", e.target.value)}
                        />
                    </label>
                    <label style={{ display: "grid", gap: "0.25rem", fontWeight: "bold" }}>
                        End
                        <input
                            type="time"
                            value={draftEvent.endTime}
                            onChange={(e) => handleDraftChange("endTime", e.target.value)}
                        />
                    </label>
                </div>
            ) : (
                <>
                    <p><strong>Title:</strong> {event.name || "N/A"}</p>
                    <p><strong>Date:</strong> {formatDate(event.startDate) || "N/A"}</p>
                    <p><strong>Time:</strong> {event.allDay
                        ? "All-day"
                        : `${formatTime(event.startTime)} - ${formatTime(event.endTime)}`}</p>
                    <p><strong>Location:</strong> {event.location || "N/A"}</p>
                    <p><strong>Description:</strong> {event.desc || "No description."}</p>
                </>
            )}

            <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem" }}>
                {isEditing ? (
                    <>
                        <button
                            onClick={handleSave}
                            style={{ ...actionButtonStyle, background: "#8b0000" }}
                        >
                            Save
                        </button>
                        <button
                            onClick={() => setIsEditing(false)}
                            style={{ ...actionButtonStyle, background: "#555" }}
                        >
                            Cancel
                        </button>
                    </>
                ) : (
                    <>
                        <button
                            onClick={() => setIsEditing(true)}
                            style={{ ...actionButtonStyle, background: "#8b0000" }}
                        >
                            Edit
                        </button>
                        <button
                            onClick={() => onArchive?.(event)}
                            style={{ ...actionButtonStyle, background: "#555" }}
                        >
                            Archive
                        </button>
                    </>
                )}
                <button
                    onClick={onClose}
                    style={{ ...actionButtonStyle, background: "#333" }}
                >
                    Close
                </button>
            </div>
        </div>
    );
}

export default UserEventPopup;
