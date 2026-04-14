import { useEffect, useState, useRef } from "react";
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
	const [colorList, setColorList] = useState({});
	
	const handleClose = () => setShow(false);
  	const handleShow = () => setShow(true);
	
	const handleSelect = (event) => {
		setSelect(event);
		setShow(true);
		setmodalTitle(event.title);
		
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

		/**
 		* Listens for messages indicating that a user created event has been created or updated.
 		*/
		const handleMessage = (message, sender, sendResponse) => {
            if (message.type === "EVENT_CREATED" || message.type === "EVENT_UPDATED" || message.type === "UPDATE_ASSIGNMENTS" || message.type === "GOOGLE_CALENDAR_UPDATED") {
                fetchEvents();
				getColors();
				sendResponse(true);
				return true;
            }
        };

        chrome.runtime.onMessage.addListener(handleMessage);
        return () => chrome.runtime.onMessage.removeListener(handleMessage);
	}, []);

	return (
  	<div >
    	  <Calendar
      	  localizer={localizer}
      	  events={events}	
          defaultView= 'day'		
          views= {['day', 'week']}	
      	  startAccessor="start"
      	  endAccessor="end"
		  allDayAccessor="allDay"
      	  min= {minLimit}
      	  max= {maxLimit}
      	  defaultDate = {new Date()}
      	  selected = {select}
      	  onSelectEvent = {handleSelect}
      	  style={{ height: 700 }}
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
    	  <Modal show={show} onHide={handleClose}>
        	<Modal.Header closeButton closeVariant="black">
          		<Modal.Title>{modalTitle}</Modal.Title>
        	</Modal.Header>
        	<Modal.Body style={{ whiteSpace: 'pre' }} >{modalBody}</Modal.Body>
        	<Modal.Footer>
          	<Button variant="secondary" onClick={handleClose} style={{color:"#ffffff"}}>
            		Close
          	</Button>
        	</Modal.Footer>
      	  </Modal>
  	</div>
	);  
}

export default CalendarMenu;

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
				const userCalendarEvents = userEvents.map(event => ({
					title: event.title,
					start: event.allDay ? new Date(`${event.startDate}T00:00:00`) : new Date(`${event.startDate}T${event.startTime}:00`),
					end: event.allDay ? new Date(`${event.startDate}T00:00:00`) : new Date(`${event.startDate}T${event.endTime}:00`),
					allDay: event.allDay,
					description: event.desc,
					location: event.location,
					eventType: "userEvents",
					id: 1 // set id to 1 for user created events
				}));
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
				const ICCalendarEvents = ICEvents.map(event => ({
					title: event.name,
					start: new Date(`${event.startDate} ${event.startTime}`),
					end: new Date(`${event.endDate} ${event.endTime}`),
					organization: event.organization,
					location: event.location,
					link: event.link,
					eventType: "InvolvementCenter",
					id: 2
				}));
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
				const UNLVCalendarEvents = UNLVEvents.map(event => ({
					title: event.name,
					start: (event.startTime === "(ALL DAY)") ? new Date(`${event.startDate}T00:00:00`) : new Date(`${event.startDate} ${event.startTime}`),
					end: (event.endTime === "") ? (event.startTime === "(ALL DAY)") ? new Date(`${event.endDate}T00:00:00`) : new Date(`${event.startDate} ${event.startTime}`) : new Date(`${event.endDate} ${event.endTime}`),
					allDay: (event.startTime === "(ALL DAY)"),
					location: event.location,
					link: event.link,
					eventType: "UNLVEvents",
					id: 3
				}));
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
				const importedGoogleEvents = googleEvents.map(event => ({
					title: event.title,
					start: (event.startTime === "(ALL DAY)") ? new Date(`${event.startDate}T00:00:00`) : new Date(`${event.startDate}T${event.startTime}:00`),
					end: (event.endTime === "") ? (event.startTime === "(ALL DAY)") ? new Date(`${event.endDate}T00:00:00`) : new Date(`${event.startDate}T${event.startTime}:00`) : new Date(`${event.endDate}T${event.endTime}:00`),
					allDay: (event.startTime === "(ALL DAY)"),
					location: event.location,
					description: event.desc,
					link: event.link,
					eventType: "googleCalendar",
					id: 4
				}));
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
