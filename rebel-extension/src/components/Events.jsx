import { useEffect, useState } from "react";
import './css/Events.css';
import addcalendarIcon from "../assets/addcalendarIcon.png";

function Events({ events, viewMode, setActiveEventPopup = null , yourEvents = false}) {
  if (!events || events.length === 0) {
    return <div className="no-events"> No events found for this view.</div>;
  }

  const [localEvents, setLocalEvents] = useState(events);

  const getEventDisplayName = (event) => {
    if (event.link === "customEvent") {
      return `Custom Event: ${event.name}`;
    }

    return event.name;
  };

  useEffect(() => {
    const updateWithStorage = () => {
      chrome.storage.local.get("savedUNLVEvents", (data) => {
        const storedEvents = Array.isArray(data["savedUNLVEvents"]) ? data["savedUNLVEvents"] : [];
  
        const updated = events.map(event => {
          const isAdded = storedEvents.some(
            (e) => e.name === event.name && e.startTime === event.startTime && e.startDate === event.startDate
          );
          return { ...event, added: isAdded };
        });
  
        setLocalEvents(updated);
      });
    };
  
    updateWithStorage(); // run immediately on mount
  
    const handleMessage = (message) => {
      if (message.type === "EVENT_UPDATED") {
        updateWithStorage(); // update again when an event is added/removed
      }
    };

    chrome.runtime.onMessage.addListener(handleMessage);
    return () => chrome.runtime.onMessage.removeListener(handleMessage);
  }, [events]); 

  
  function formatDate(dateString) {
    const [year, month, day] = dateString.split("-").map(Number);
    const date = new Date(year, month - 1, day); // force local time
  
    const options = { month: 'long' };
    const monthName = date.toLocaleDateString('en-US', options);
  
    let suffix = "th";
    if (day % 10 === 1 && day !== 11) suffix = "st";
    else if (day % 10 === 2 && day !== 12) suffix = "nd";
    else if (day % 10 === 3 && day !== 13) suffix = "rd";
  
    return `${monthName} ${day}${suffix}`;
  }  

  const sortedEvents = [...localEvents].sort((a, b) => {
    const aDate = new Date(`${a.startDate} ${a.startTime}`);
    const bDate = new Date(`${b.startDate} ${b.startTime}`);
    return aDate - bDate; // soonest to latest
  });

  const handleAddEvent = (event) => {  
        chrome.storage.local.get("savedUNLVEvents", (data) => {
            const existing = Array.isArray(data["savedUNLVEvents"]) ? data["savedUNLVEvents"] : [];
            const updatedEvents = [...existing, event];

            chrome.storage.local.set({ "savedUNLVEvents": updatedEvents }, () => {
                // alert("Event saved to calendar.");

                chrome.runtime.sendMessage({ type: "EVENT_UPDATED" });
            });
        });
   };

function handleRemoveEvent(event) {
    chrome.storage.local.get("savedUNLVEvents", (data) => {
        const existing = Array.isArray(data["savedUNLVEvents"]) ? data["savedUNLVEvents"] : [];

        const updatedEvents = existing.filter(
            (e) => !(e.name === event.name && e.startTime === event.startTime && e.startDate === event.startDate)
        );

        chrome.storage.local.set({ "savedUNLVEvents": updatedEvents }, () => {
            chrome.runtime.sendMessage({ type: "EVENT_UPDATED" });
        });
    });
}


  if (viewMode === "weekly") {
    const grouped = {};
    sortedEvents.forEach(event => {
      const [year, month, day] = event.startDate.split('-');
      const date = new Date(year, month - 1, day);
      const weekday = date.toLocaleDateString('en-US', { weekday: 'long' });
      if (!grouped[weekday]) grouped[weekday] = [];
      grouped[weekday].push(event);
    });

    const weekdayNames = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
    const todayIndex = new Date().getDay();
    const orderedWeekdays = [...weekdayNames.slice(todayIndex), ...weekdayNames.slice(0, todayIndex)];

    const getRelativeWeekdayLabel = (dayName) => {
      const dayIndex = weekdayNames.indexOf(dayName);
      if (dayIndex === -1) {
        return dayName;
      }

      if (dayIndex === todayIndex) {
        return "Today";
      }

      if (dayIndex === (todayIndex + 1) % 7) {
        return "Tomorrow";
      }

      return dayName;
    };
      
    return orderedWeekdays
      .filter(day => grouped[day])
      .map(day => (
        <div key={day} className="weekday-section">
          <div className="weekday-title">{getRelativeWeekdayLabel(day)}</div>
          {/* <hr className="weekday-divider" /> */}
          <ul className={`event-list ${viewMode === 'daily' ? 'event-list-daily' : ''}`}>
            {grouped[day].map(event => (
              <li key={event.id} className="event-item">
              {event.academicCalendar ? (
              // Format for Academic Calendar event
              <>
              <div className="event-name" style={{marginRight: "10px"}}>
                <span className="event-org" style={{fontWeight: "bold"}}>
                  Academic Calendar: 
                </span>
                {" " + event.name}
              </div>
              <div className="event-time">
                {formatDate(event.startDate)}
              </div>
            </>
            ) :
              event.link === "customEvent" ? ( // Custom Events
                  <>
                    <a
                      className="event-link"
                      href="#"
                      onClick={(e) => {
                        e.preventDefault();
                        setActiveEventPopup(event);
                      }}
                    >
                      <span className="event-name">
                        <span className="event-org">
                          {event.organization}
                          {event.organization ? ':' : ''}{" "}
                        </span>
                        {getEventDisplayName(event)}
                      </span>
                      </a>
                      <span className="event-time">{event.time /* NOT startTime (unformatted) */}</span> 
                  </>
                ) : (<>
                  <a
                    href={event.link}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="event-link"
                  >
                      <span className="event-name">
                        <span className="event-org">
                          {event.organization}
                          {event.organization ? ':' : ''}{" "}
                        </span>
                      {getEventDisplayName(event)}
                    </span>
                    </a>
                    <span className="event-time">{event.startTime}
                    {(!yourEvents || event.savedUNLVEvent) && (
                      <div className="tooltip-container">
                      {!event.savedUNLVEvent && !event.added ? (
                        // Show Add to Calendar
                        <button
                          className="addCalbtn"
                          onClick={() => handleAddEvent(event)}
                          aria-label="add to calendar"
                        >
                          <img src={addcalendarIcon} height="25px" width="25px" alt="Add to Calendar" />
                        </button>
                      ) : (
                        // Show Remove from Calendar
                        <button
                          className="removeCalbtn"
                          onClick={() => handleRemoveEvent(event)}
                          aria-label="remove from calendar"
                        >
                          ✖
                        </button>
                      )}
                      {/* Tooltip text */}
                      <span className="tooltip-text">
                        {!event.savedUNLVEvent && !event.added ? "Add to Your Events" : "Remove from Your Events"}
                      </span>
                    </div>                    
                    )}
                    </span>               
                </>
                )}
              </li>

            ))}
          </ul>
        </div>
      ));
  }

  return (
    <ul className={`event-list ${viewMode === 'daily' ? 'event-list-daily' : ''}`}>
      {sortedEvents.map(event => (
        <li key={event.id} className="event-item">
        
        {event.academicCalendar ? (
        // Format for Academic Calendar event
        <>
          <div className="event-name" style={{marginRight: "10px"}}>
            <span className="event-org" style={{fontWeight: "bold"}}>
              Academic Calendar: 
            </span>
            {" " + event.name}
          </div>
          <div className="event-time">
            {formatDate(event.startDate)}
          </div>
        </>
      ) : event.link === "customEvent" ? ( // Custom Events
            <>
              <a
                className="event-link"
                href="#"
                onClick={(e) => {
                  e.preventDefault();
                  setActiveEventPopup(event);
                }}
              >
                <span className="event-name">
                  <span className="event-org">
                    {event.organization}
                    {event.organization ? ':' : ''}{" "}
                  </span>
                  {getEventDisplayName(event)}
                </span>
                </a>
                <span className="event-time">{event.time}</span>
            </>
          ) : (<>
            <a
              href={event.link}
              target="_blank"
              rel="noopener noreferrer"
              className="event-link"
            >
              <span className="event-name">
                <span className="event-org">
                  {event.organization}
                  {event.organization ? ':' : ''}{" "}
                </span>
                {getEventDisplayName(event)}
              </span>
              </a>
              <span className="event-time">{event.startTime}
              {(!yourEvents || event.savedUNLVEvent) && (
                <div className="tooltip-container">
                {!event.savedUNLVEvent && !event.added ? (
                  // Show Add to Calendar
                  <button
                    className="addCalbtn"
                    onClick={() => handleAddEvent(event)}
                    aria-label="add to calendar"
                  >
                    <img src={addcalendarIcon} height="25px" width="25px" alt="Add to Calendar" />
                  </button>
                ) : (
                  // Show Remove from Calendar
                  <button
                    className="removeCalbtn"
                    onClick={() => handleRemoveEvent(event)}
                    aria-label="remove from calendar"
                  >
                    ✖
                  </button>
                )}
                {/* Tooltip text */}
                <span className="tooltip-text">
                  {!event.savedUNLVEvent && !event.added ? "Add to Your Events" : "Remove from Your Events"}
                </span>
              </div>              
              )}
              </span>
            </>
          )}
        </li>
      ))}
    </ul>
  );
}

export default Events;
