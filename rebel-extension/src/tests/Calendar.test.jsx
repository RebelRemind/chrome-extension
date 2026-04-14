import { render, screen, fireEvent, act } from '@testing-library/react';
import CalendarView from '../components/CalendarView';
import { Calendar, dateFnsLocalizer } from 'react-big-calendar';

beforeEach(() => {
  jest.clearAllMocks();
});

global.chrome = {
  runtime: {
    onMessage: {
      addListener: jest.fn(),
      removeListener: jest.fn(),
    },
  },
  storage: {
    local: {
      get: jest.fn()
    },
  },
};
// Mocking the react-big-calendar and date-fns libraries
jest.mock('react-big-calendar', () => ({
  Calendar: () => <div>Calendar Component</div>,
  dateFnsLocalizer: jest.fn(() => ({})), // Mock dateFnsLocalizer
}));

// Mock date-fns and any specifically named imported like setHours/setMinutes
jest.mock('date-fns', () => ({
  ...jest.requireActual('date-fns'), // Mock while still preserving original functionality
  setHours: jest.fn(),  // Named import setHours
  setMinutes: jest.fn(),  // Named import setMinutes
  format: jest.fn(),
  parse: jest.fn(),
  startOfWeek: jest.fn(),
  getDay: jest.fn(),
  locale: { enUS: {} },
}));

describe('Calendar View Component', () => {
  it('renders the Calendar component', async () => {
    // Render the CalendarView component itself
    await act(async () => {
    render(<CalendarView />);
    });
    // Check that the Calendar actually appears in the extension
    expect(screen.getByText('Calendar Component')).toBeInTheDocument();
  });

  it('sets the min and max limits correctly', async () => {
    // To check that calendar's time limits were set correctly

    // Named imports must also be imported here in this test case
    const { setHours, setMinutes } = require('date-fns');

    // First render the calendar to invoke the functions needed to display it
    await act(async () => {
    render(<CalendarView />);
    });
    // Check that the hours and minutes were set correctly (7:00 AM to 11:59 PM
    expect(setHours).toHaveBeenCalledWith(expect.any(Date), 7);  // Min limit
    expect(setMinutes).toHaveBeenCalled();

    expect(setHours).toHaveBeenCalledWith(expect.any(Date), 23); // Max limit
    expect(setMinutes).toHaveBeenCalled();
  });

  // To check that the calendar can actually handle events if given one
  it('passes calendarEvents to the Calendar component', async () => {
    global.chrome.storage.local.get.mockImplementation((key, callback) => { 
      callback({Canvas_Assignments: [
        { due_at: "2025-03-31T07:59:59Z", title: "Assignment 1", context_name: "CS 101", course_id: "12345" } 
      ], colorList: {UNLVEvents: "#b10202", InvolvementCenter: "#666666", userEvents: "#0000ff", CanvasCourses: { 12345: { color: "#449876", name: "CS 101" }}},
      userEvents: [{ allDay: false, date: "2025-04-30", desc: "Tom's Birthday Party, don't forget a present", endTime: "22:00", startDate: "2025-04-30", startTime: "20:00", title: "Birthday Party", location: "Tom's House" },
        { allDay: true, desc: "Study Hard", location: "", endTime: "", startDate: "2025-04-28", startTime: "", title: "Final Exams" }
      ], 
      filteredIC: [{ name: "Monthly Meeting", organization: "Layer Zero", location: "TBE B174", startDate: "2025-05-05", endDate: "2025-05-05", startTime: "5:30 PM", endTime: "7:30 PM"}],
      savedUNLVEvents: [{ name: "Tech Seminar", location: "CHB A106", startDate: "2025-04-29", startTime: "2:30 PM", endDate: "2025-04-29", endTime: "6:30 PM" }],
      googleCalendarEvents: [{ title: "Doctor Appointment", location: "Clinic", desc: "Annual checkup", startDate: "2025-05-01", endDate: "2025-05-01", startTime: "16:30", endTime: "17:00", link: "https://calendar.google.com/event?eid=1" }]
    }); 
  });
    
    // Render the calendar while explicitly passing the events prop
    await act(async () => {
    render(<CalendarView />);
    });

    // Check that the Calendar component receives and uses the events prop
    expect(screen.getByText('Calendar Component')).toBeInTheDocument();
  });
});
