import { useEffect, useState } from "react";
import "../App.css";
import "./css/CalendarView.css";
import calendarEvents from "./calendarEvents.js";
import Modal from 'react-bootstrap/Modal';
import Button from 'react-bootstrap/Button';

//date-fns localizer for big-calendar
import { Calendar, dateFnsLocalizer } from 'react-big-calendar';
import format from 'date-fns/format'
import parse from 'date-fns/parse'
import startOfWeek from 'date-fns/startOfWeek'
import getDay from 'date-fns/getDay'
import enUS from 'date-fns/locale/en-US'
import { setHours } from "date-fns";
import { setMinutes } from "date-fns";

/**
 * Calendar Menu Component - Creates a calendar that takes in the current date
 *			     (from locale or machine) and displays a calendar based on the day.
 * Uses: react-big-calendar to display and format the calendar
 *	 date-fns for reading and parsing the date from the locale.
 *       react-bootstrap to display events via the "Modal" component.
 *
 * Features:
 * - Selecting "Day" or "Week" displays a range of dates based on the current date (or locale).
 *   Renders Day-view or Week-view. Should display assignments and events from backend (TBD).
 *
 * Components:
 * - CalendarView.css for styling. (Modified to fit the extension's color scheme and size)
 * - react-boostrap / Modal for displaying events in a pop-up window. (Formatted manually but styled via CalendarView.css
 *
 * Authored by: Jeremy Besitula
 * Assignment and User Created Event support by: Gunnar Dalton
 *
 * Put into component CalendarView.jsx by Jeremy Besitula
 * @returns {JSX.Element} The react-big-calendar component UI.
 */
 
function CalendarMenu() {
  	const locales = {
  	'en-US': enUS,
	}

	const localizer = dateFnsLocalizer({
  	format,
  	parse,
  	startOfWeek,
  	getDay,
  	locales,
	})

	const minLimit = setMinutes(setHours(new Date(), 7), 0);
	const maxLimit = setMinutes(setHours(new Date(), 23), 59);

	const [events, setEvents] = useState([]);
	const [select, setSelect] = useState();
	const [show, setShow] = useState(false);
	const [modalTitle, setmodalTitle] = useState('Modal Title');
	const [modalBody, setmodalBody] = useState('Modal Body');
	const [modalLink, setModalLink] = useState("");
	const [colorList, setColorList] = useState({});
	const [currentView, setCurrentView] = useState("day");
	const [currentDate, setCurrentDate] = useState(new Date());
	const [canvasIntegrationEnabled, setCanvasIntegrationEnabled] = useState(false);
	const [hasCanvasToken, setHasCanvasToken] = useState(false);
	const [canvasFetchStatus, setCanvasFetchStatus] = useState(true);
	const [canvasFetchError, setCanvasFetchError] = useState("");
	
	const handleClose = () => setShow(false);
  	const handleShow = () => setShow(true);
	
	const handleSelect = (event) => {
		setSelect(event);
		setShow(true);
		setmodalTitle(event.title);
		setModalLink(event.link || "");
		
		//IDEA:  USE A STATE OR THE EVENT TO DIRECT CONTROL FLOW TO 2 DIFFERENT TEMPLATES FOR FORMATTING
		//	 EVENT (1) 	--> TITLE, STARTS, ENDS, DESCRIPTION, LOCATION
		//				*NOTE: EVENT MAY HAVE A COMBINATION OF: DESCRIPTION AND LOCATION, ONE OR THE OTHER IS MISSING, BOTH ARE MISSING
		//	 ASSIGNMENT (0) --> TITLE, DUE, COURSE
		
		if(event.id === 1){
			const eventStart = "Started at:\t\t" + ((event.start).toString()).slice(0,15) + ", " + (event.start).toLocaleTimeString('en-US', {
			hour: 'numeric',
			minute: 'numeric',
			hour12: 'true'
			}) + '\n';
			const eventEnd = "Ends at:\t\t" + ((event.end).toString()).slice(0,15) + ", " + (event.end).toLocaleTimeString('en-US', {
			hour: 'numeric',
			minute: 'numeric',
			hour12: 'true'
			}) + '\n';
			const eventDate = ((event.start).getTime() === (event.end).getTime()) ? ("Date:\t\t\t" + ((event.start).toString()).slice(0,15) + ", " + (event.start).toLocaleTimeString('en-US', {
			hour: 'numeric',
			minute: 'numeric',
			hour12: 'true'
			}) + '\n') : ( undefined ) ;
			const eventLocation = event.location === undefined ? "" : ("Location:\t\t" + (event.location).toString() + '\n');
			const eventDesc = event.description === undefined ? "" :  ("Description:\t" + (event.description).toString());
		
			if(eventDate === undefined){
				setmodalBody(eventStart + eventEnd + eventLocation + eventDesc);}
			else{
				setmodalBody(eventDate + eventLocation + eventDesc);}
			
		} 
		else if (event.id === 0) {
			const eventDue = "Due at:\t\t" + ((event.end).toString()).slice(0,15) + ", " + (event.end).toLocaleTimeString('en-US', {
			hour: 'numeric',
			minute: 'numeric',
			hour12: 'true'
			}) + '\n';
			const eventCourse = "Course:\t\t" + (event.course).toString();
			setmodalBody(eventDue + eventCourse);
		}
		else if (event.id === 2) {
			const eventStart = "Started at:\t" + ((event.start).toString()).slice(0,15) + ", " + (event.start).toLocaleTimeString('en-US', {
				hour: 'numeric',
				minute: 'numeric',
				hour12: 'true'
				}) + '\n';
				const eventEnd = "Ends at:\t\t" + ((event.end).toString()).slice(0,15) + ", " + (event.end).toLocaleTimeString('en-US', {
				hour: 'numeric',
				minute: 'numeric',
				hour12: 'true'
				}) + '\n';
				const eventDate = ((event.start).getTime() === (event.end).getTime()) ? ("Date:\t\t\t" + ((event.start).toString()).slice(0,15) + ", " + (event.start).toLocaleTimeString('en-US', {
				hour: 'numeric',
				minute: 'numeric',
				hour12: 'true'
				}) + '\n') : ( undefined ) ;
				const eventLocation = event.location === undefined ? "" : ("Location:\t\t" + (event.location).toString() + '\n');
				const eventOrg = event.organization === undefined ? "" :  ("Organization:\t" + (event.organization).toString());
				const eventLink = event.link === undefined ? "" : (event.link).toString();
			
				if(eventDate === undefined){
					setmodalBody(
						<>
							<div>{eventStart}</div>
							<div>{eventEnd}</div>
							<div>{eventLocation}</div>
							<div>{eventOrg}</div>
							<div style={{ whiteSpace: "normal", wordWrap: "break-word", overflowWrap: "break-word" }}>
								More Details:&#9;
								<a href={eventLink} target="_blank" rel="noopener noreferrer">
									{eventLink}
								</a>
							</div>
						</>
					);
					// setmodalBody(eventStart + eventEnd + eventLocation + eventOrg);
				}
				else{
					setmodalBody(
						<>
							<div>{eventDate}</div>
							<div>{eventLocation}</div>
							<div>{eventOrg}</div>
							<div style={{ whiteSpace: "normal", wordWrap: "break-word", overflowWrap: "break-word" }}>
								More Details:&#9;
								<a href={eventLink} target="_blank" rel="noopener noreferrer">
									{eventLink}
								</a>
							</div>
						</>
					);
					// setmodalBody(eventDate + eventLocation + eventOrg);
				}
		}
		else if (event.id === 3) {
			const eventStart = "Started at:\t" + ((event.start).toString()).slice(0,15) + ", " + (event.start).toLocaleTimeString('en-US', {
				hour: 'numeric',
				minute: 'numeric',
				hour12: 'true'
				}) + '\n';
				const eventEnd = "Ends at:\t\t" + ((event.end).toString()).slice(0,15) + ", " + (event.end).toLocaleTimeString('en-US', {
				hour: 'numeric',
				minute: 'numeric',
				hour12: 'true'
				}) + '\n';
				const eventDate = ((event.start).getTime() === (event.end).getTime()) ? ("Date:\t\t\t" + ((event.start).toString()).slice(0,15) + ", " + (event.start).toLocaleTimeString('en-US', {
				hour: 'numeric',
				minute: 'numeric',
				hour12: 'true'
				}) + '\n') : ( undefined ) ;
				const eventLocation = event.location === undefined ? "" : ("Location:\t\t" + (event.location).toString() + '\n');
				const eventLink = event.link === undefined ? "" : (event.link).toString();
			
				if(eventDate === undefined){
					setmodalBody(
						<>
							<div>{eventStart}</div>
							<div>{eventEnd}</div>
							<div>{eventLocation}</div>
							<div style={{ whiteSpace: "normal", wordWrap: "break-word", overflowWrap: "break-word" }}>
								More Details:&#9;
								<a href={eventLink} target="_blank" rel="noopener noreferrer">
									{eventLink}
								</a>
							</div>
						</>
					);
				}
				else{
					setmodalBody(
						<>
							<div>{eventDate}</div>
							<div>{eventLocation}</div>
							<div style={{ whiteSpace: "normal", wordWrap: "break-word", overflowWrap: "break-word" }}>
								More Details:&#9;
								<a href={eventLink} target="_blank" rel="noopener noreferrer">
									{eventLink}
								</a>
							</div>
						</>
					);
				}
		}
		else if (event.id === 4) {
			const eventStart = event.allDay ? "Date:\t\t\t" + ((event.start).toString()).slice(0,15) + '\n' : "Started at:\t" + ((event.start).toString()).slice(0,15) + ", " + (event.start).toLocaleTimeString('en-US', {
				hour: 'numeric',
				minute: 'numeric',
				hour12: 'true'
				}) + '\n';
			const eventEnd = event.allDay ? "" : "Ends at:\t\t" + ((event.end).toString()).slice(0,15) + ", " + (event.end).toLocaleTimeString('en-US', {
				hour: 'numeric',
				minute: 'numeric',
				hour12: 'true'
				}) + '\n';
			const eventLocation = event.location === undefined ? "" : ("Location:\t\t" + (event.location).toString() + '\n');
			const eventDesc = event.description === undefined ? "" : ("Description:\t" + (event.description).toString() + '\n');
			const eventLink = event.link === undefined ? "" : (event.link).toString();
			
			setmodalBody(
				<>
					<div>{eventStart}</div>
					{eventEnd ? <div>{eventEnd}</div> : null}
					<div>{eventLocation}</div>
					<div>{eventDesc}</div>
					{eventLink ? (
						<div style={{ whiteSpace: "normal", wordWrap: "break-word", overflowWrap: "break-word" }}>
							More Details:&#9;
							<a href={eventLink} target="_blank" rel="noopener noreferrer">
								{eventLink}
							</a>
						</div>
					) : null}
				</>
			);
		}
	};

	/**
     * Effect Hook: Load the stored Canvas assignments and user created events when the component mounts.
     */
	useEffect(() => {
		/**
 		* Calls the correct functions to get Canvas assignments and user created events and places them together in one array.
 		*/
		const fetchEvents = async () => {
			const canvasAssignments = await getCanvasAssignments();
			const userEvents = await getUserEvents();
			const ICEvents = await getInolvementCenterEvents();
			const UNLVEvents = await getSavedUNLVEvents();
			const googleEvents = await getGoogleCalendarEvents();
			setEvents([ ...canvasAssignments, ...userEvents, ...ICEvents, ...UNLVEvents, ...googleEvents]);
		};
		fetchEvents();
		
		const getColors = async () => {
			chrome.storage.local.get("colorList", (data) => {
			const colorList = data.colorList || {};
			setColorList(colorList);
			});
		};
		getColors();

		const getCanvasStatus = async () => {
			if (chrome?.storage?.sync?.get) {
				chrome.storage.sync.get("preferences", (data) => {
					setCanvasIntegrationEnabled(Boolean(data.preferences?.canvasIntegration));
				});
			} else {
				setCanvasIntegrationEnabled(false);
			}

			if (chrome?.storage?.local?.get) {
				chrome.storage.local.get(["canvasPAT", "CanvasFetchStatus"], (data) => {
				setHasCanvasToken(Boolean(data.canvasPAT));

				if (!data.CanvasFetchStatus) {
					setCanvasFetchStatus(true);
					setCanvasFetchError("");
					return;
				}

				if (data.CanvasFetchStatus.success === false) {
					setCanvasFetchStatus(false);
					setCanvasFetchError(data.CanvasFetchStatus.error || "");
					return;
				}

				setCanvasFetchStatus(true);
				setCanvasFetchError("");
				});
			} else {
				setHasCanvasToken(false);
				setCanvasFetchStatus(true);
				setCanvasFetchError("");
			}
		};
		getCanvasStatus();

		/**
 		* Listens for messages indicating that a user created event has been created or updated.
 		*/
		const handleMessage = (message, sender, sendResponse) => {
            if (message.type === "EVENT_CREATED" || message.type === "EVENT_UPDATED" || message.type === "UPDATE_ASSIGNMENTS" || message.type === "GOOGLE_CALENDAR_UPDATED") {
                fetchEvents();
				getColors();
				getCanvasStatus();
				sendResponse(true);
				return true;
            }
        };

        chrome.runtime.onMessage.addListener(handleMessage);
        return () => chrome.runtime.onMessage.removeListener(handleMessage);
	}, []);

	const canvasAssignments = events
		.filter((event) => event.id === 0)
		.filter((event) => isAssignmentVisibleForView(event, currentDate, currentView))
		.sort((left, right) => left.end - right.end);

	const calendarEventsForGrid = events.filter((event) => event.id !== 0);
	const shouldShowCanvasDueStrip = canvasIntegrationEnabled;
	const calendarViewTitle = currentView === "week" ? "Your week at a glance." : "Your day at a glance.";
	const eventComponents = {
		event: (props) => <CalendarEventContent {...props} currentView={currentView} />,
	};
	const canvasDueMessage = getCanvasDueMessage({
		canvasIntegrationEnabled,
		hasCanvasToken,
		canvasFetchStatus,
		canvasFetchError,
		currentView,
		hasAssignments: canvasAssignments.length > 0,
	});

	return (
  	<div className="calendar-view-shell">
		<div className="calendar-view-frame">
			<div className="calendar-view-header">
				<p className="calendar-view-eyebrow">Calendar View</p>
				<h2 className="calendar-view-title">{calendarViewTitle}</h2>
			</div>
			{shouldShowCanvasDueStrip ? (
				<div className="calendar-due-strip">
					<div className="calendar-due-label">Due</div>
					{canvasAssignments.length ? (
						<div className="calendar-due-list">
							{canvasAssignments.map((assignment) => {
								const courseColors = colorList?.CanvasCourses || {};
								const courseColor = courseColors?.[assignment.courseID]?.color
									|| courseColors?.[String(assignment.courseID)]?.color
									|| "#666666";
								const textColor = getTextColor(courseColor);

								return (
									<button
										key={`${assignment.title}-${assignment.courseID}-${assignment.end.toISOString()}`}
										type="button"
										onClick={() => handleSelect(assignment)}
										className="calendar-due-pill"
										style={{ backgroundColor: courseColor, color: textColor }}
									>
										<span className="calendar-due-pill-copy">
											<span className="calendar-due-pill-title">{assignment.title}</span>
											<span className="calendar-due-pill-day">{formatDueDateTimeLine(assignment.end)}</span>
										</span>
									</button>
								);
							})}
						</div>
					) : (
						<div className="calendar-due-empty">{canvasDueMessage}</div>
					)}
				</div>
			) : null}
	    	<Calendar
	      	  localizer={localizer}
	      	  events={calendarEventsForGrid}	
	          defaultView= 'day'		
	          views= {['day', 'week']}	
			  view={currentView}
			  date={currentDate}
			  onView={setCurrentView}
			  onNavigate={setCurrentDate}
	      	  startAccessor="start"
	      	  endAccessor="end"
			  allDayAccessor="allDay"
	      	  min= {minLimit}
	      	  max= {maxLimit}
	      	  defaultDate = {new Date()}
	      	  selected = {select}
			  onSelectEvent = {handleSelect}
			  components={eventComponents}
	      	  style={{ height: 640 }}
			  className="rr-sidepanel-calendar"
			  // ai-gen start (ChatGPT-4o, 2)
			  eventPropGetter={(event) => {
				let backgroundColor = "#3174ad";
				if (event.id === 0) {
					const courseColors = colorList?.CanvasCourses || {};
					backgroundColor = courseColors?.[event.courseID]?.color || "#3174ad";
				}
				else {
					backgroundColor = colorList?.[event.eventType] || "#8b0000";
				}
				const textColor = getTextColor(backgroundColor);
				return {
					style: {
						backgroundColor,
						color: textColor
					}
				};
			  }}
			  // ai-gen end   
	    	  />
		</div>
	    	<Modal
			show={show}
			onHide={handleClose}
			dialogClassName="calendar-event-modal"
			contentClassName="calendar-event-modal-content"
		>
	        	<Modal.Header closeButton closeVariant="black">
	          		<Modal.Title>{modalTitle}</Modal.Title>
	        	</Modal.Header>
	        	<Modal.Body style={{ whiteSpace: 'pre' }} >{modalBody}</Modal.Body>
	        	<Modal.Footer>
				{modalLink ? (
					<Button
						as="a"
						href={modalLink}
						target="_blank"
						rel="noopener noreferrer"
						variant="secondary"
						style={{color:"#ffffff", marginRight:"auto"}}
					>
						Take Me
					</Button>
				) : null}
	          	<Button variant="secondary" onClick={handleClose} style={{color:"#ffffff"}}>
	            		Close
	          	</Button>
	        	</Modal.Footer>
	      	  </Modal>
  	</div>
	);  
}

export default CalendarMenu;

function CalendarEventContent({ event, currentView }) {
	if (!event) {
		return null;
	}

	return (
		<div className="calendar-event-copy">
			<div className="calendar-event-title">{event.title}</div>
		</div>
	);
}

function isAssignmentVisibleForView(event, currentDate, currentView) {
	const dueDate = new Date(event.end);
	if (Number.isNaN(dueDate.getTime())) {
		return false;
	}

	const selectedDate = new Date(currentDate);
	selectedDate.setHours(0, 0, 0, 0);
	const eventDate = new Date(dueDate);
	eventDate.setHours(0, 0, 0, 0);

	if (currentView === "week") {
		const weekStart = startOfWeek(selectedDate, { weekStartsOn: 0 });
		const weekEnd = new Date(weekStart);
		weekEnd.setDate(weekEnd.getDate() + 6);
		weekEnd.setHours(23, 59, 59, 999);
		return dueDate >= weekStart && dueDate <= weekEnd;
	}

	return selectedDate.getTime() === eventDate.getTime();
}

function formatDueTime(value) {
	if (!(value instanceof Date) || Number.isNaN(value.getTime())) {
		return "";
	}

	return value.toLocaleTimeString("en-US", {
		hour: "numeric",
		minute: "2-digit",
		hour12: true,
	});
}

function formatDueDateTimeLine(value) {
	if (!(value instanceof Date) || Number.isNaN(value.getTime())) {
		return "";
	}

	const dayPart = value.toLocaleDateString("en-US", {
		weekday: "short",
		month: "short",
		day: "numeric",
	}).toUpperCase();
	const timePart = value.toLocaleTimeString("en-US", {
		hour: "numeric",
		minute: "2-digit",
		hour12: true,
	}).replace(/\s/g, "");

	return `${dayPart} ${timePart}`;
}

function addDefaultHour(dateValue) {
	if (!(dateValue instanceof Date) || Number.isNaN(dateValue.getTime())) {
		return dateValue;
	}

	return new Date(dateValue.getTime() + (60 * 60 * 1000));
}

function getCanvasDueMessage({
	canvasIntegrationEnabled,
	hasCanvasToken,
	canvasFetchStatus,
	canvasFetchError,
	currentView,
	hasAssignments,
}) {
	if (!canvasIntegrationEnabled) {
		return "";
	}

	if (!hasCanvasToken) {
		return "Canvas token not working!";
	}

	if (!canvasFetchStatus) {
		if (canvasFetchError === "Invalid Canvas Access Token") {
			return "Canvas token not working!";
		}

		return "Canvas token not working!";
	}

	if (hasAssignments) {
		return "";
	}

	return currentView === "week" ? "No assignments due this week." : "No assignments due today.";
}

/**
 * Gets the list of Canvas assignments from storage and formats it in the correct way to be handled by the calendar.
 */
const getCanvasAssignments = async () => {
	return new Promise ((resolve) => {
		chrome.storage.local.get("Canvas_Assignments", (data) => {
			if (data.Canvas_Assignments) { 
				const assignmentList = data.Canvas_Assignments;
				const canvasAssignments = assignmentList.map(assignment => ({
					title: assignment.title,
					start: new Date(assignment.due_at),
					end: new Date(assignment.due_at),
					course: assignment.context_name,
					courseID: assignment.course_id,
					link: assignment.html_url,
					id: 0 // set id to 0 for Canvas assignments
				}));
				resolve(canvasAssignments);
			} 
			else { 
				resolve([]); 
			}
		});
	})
};

/**
 * Gets the list of user created events from storage and formats it in the correct way to be handled by the calendar.
 */
const getUserEvents = async () => {
	return new Promise ((resolve) => {
		chrome.storage.local.get("userEvents", (data) => {
			if (data.userEvents) { 
				const userEvents = data.userEvents;
				const userCalendarEvents = userEvents.map((event) => {
					const start = event.allDay
						? new Date(`${event.startDate}T00:00:00`)
						: new Date(`${event.startDate}T${event.startTime}:00`);
					const end = event.allDay
						? new Date(`${event.startDate}T00:00:00`)
						: event.endTime
							? new Date(`${event.startDate}T${event.endTime}:00`)
							: addDefaultHour(start);

					return {
						title: event.title,
						start,
						end,
						allDay: event.allDay,
						description: event.desc,
						location: event.location,
						eventType: "userEvents",
						id: 1 // set id to 1 for user created events
					};
				});
				resolve(userCalendarEvents);
			} 
			else { 
				resolve([]); 
			}
		});
	})
};

/**
 * Gets the list of Involvement Center events from storage and formats it in the correct way to be handled by the calendar.
 */
const getInolvementCenterEvents = async() => {
	return new Promise ((resolve) => {
		chrome.storage.local.get("filteredIC", (data) => {
			if (data.filteredIC) {
				const ICEvents = data.filteredIC;
				const ICCalendarEvents = ICEvents.map((event) => {
					const start = new Date(`${event.startDate} ${event.startTime}`);
					const end = event.endDate && event.endTime
						? new Date(`${event.endDate} ${event.endTime}`)
						: addDefaultHour(start);

					return {
						title: event.name,
						start,
						end,
						organization: event.organization,
						location: event.location,
						link: event.link,
						eventType: "InvolvementCenter",
						id: 2
					};
				});
				resolve(ICCalendarEvents);
			}
			else {
				resolve([]);
			}
		})
	})
}

/**
 * Gets the list of saved UNLV events from storage and formats it in the correct way to be handled by the calendar.
 */
const getSavedUNLVEvents = async() => {
	return new Promise ((resolve) => {
		chrome.storage.local.get("savedUNLVEvents", (data) => {
			if (data.savedUNLVEvents) {
				const UNLVEvents = data.savedUNLVEvents;
				const UNLVCalendarEvents = UNLVEvents.map((event) => {
					const allDay = event.startTime === "(ALL DAY)";
					const start = allDay
						? new Date(`${event.startDate}T00:00:00`)
						: new Date(`${event.startDate} ${event.startTime}`);
					const end = allDay
						? new Date(`${event.endDate || event.startDate}T00:00:00`)
						: event.endTime
							? new Date(`${event.endDate || event.startDate} ${event.endTime}`)
							: addDefaultHour(start);

					return {
						title: event.name,
						start,
						end,
						allDay,
						location: event.location,
						link: event.link,
						eventType: "UNLVEvents",
						id: 3
					};
				});
				resolve(UNLVCalendarEvents);
			}
			else {
				resolve([]);
			}
		})
	})
}

const getGoogleCalendarEvents = async() => {
	return new Promise ((resolve) => {
		chrome.storage.local.get("googleCalendarEvents", (data) => {
			if (data.googleCalendarEvents) {
				const googleEvents = data.googleCalendarEvents;
				const importedGoogleEvents = googleEvents.map((event) => {
					const allDay = event.startTime === "(ALL DAY)";
					const start = allDay
						? new Date(`${event.startDate}T00:00:00`)
						: new Date(`${event.startDate}T${event.startTime}:00`);
					const end = allDay
						? new Date(`${event.endDate || event.startDate}T00:00:00`)
						: event.endTime
							? new Date(`${event.endDate || event.startDate}T${event.endTime}:00`)
							: addDefaultHour(start);

					return {
						title: event.title,
						start,
						end,
						allDay,
						location: event.location,
						description: event.desc,
						link: event.link,
						eventType: "googleCalendar",
						id: 4
					};
				});
				resolve(importedGoogleEvents);
			}
			else {
				resolve([]);
			}
		})
	})
}

/**
 * Determine which text color to use based on background color of event.
 */
// ai-gen start (ChatGPT-4o, 0)
function getTextColor(backgroundColor) {
	if (!backgroundColor || typeof backgroundColor !== "string" || !backgroundColor.startsWith("#") || backgroundColor.length < 7) {
		return "white";
	}

	const r = parseInt(backgroundColor.substring(1, 3), 16);
	const g = parseInt(backgroundColor.substring(3, 5), 16);
	const b = parseInt(backgroundColor.substring(5, 7), 16);

	if ([r, g, b].some((value) => Number.isNaN(value))) {
		return "white";
	}

	const brightness = (r * 299 + g * 587 + b * 114) / 1000;
	return brightness > 125 ? "black" : "white";
}
// ai-gen end
