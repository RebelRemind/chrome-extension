/**
 * AccordionMenu.test.jsx
 *
 * Updated for testing with image + text headers, asset mocks
 */

import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import AccordionMenu from "../components/AccordionMenu";

// Mocks
jest.mock("react-bootstrap/Accordion", () => {
  const RealAccordion = jest.requireActual("react-bootstrap/Accordion");
  return {
    ...RealAccordion,
    Item: ({ children, ...props }) => <div {...props}>{children}</div>,
    Header: ({ children, onClick }) => (
      <div role="button" onClick={onClick}>
        {children}
      </div>
    ),
    Body: ({ children }) => <div>{children}</div>,
  };
});

jest.mock("../components/Toggle", () => ({ isChecked, onChange }) => (
  <button onClick={onChange}>{isChecked ? "Weekly" : "Daily"}</button>
));

jest.mock("../components/CanvasAssignments", () => () => (
  <div>Canvas Assignments</div>
));

jest.mock("../components/Events", () => (props) => {
  const { setActiveEventPopup } = props;
  return (
    <div>
      <span
        data-testid="custom-event"
        onClick={() =>
          setActiveEventPopup({
            name: "Test Event",
            startDate: "2025-04-22",
            allDay: false,
            startTime: "14:00",
            endTime: "15:00",
            location: "Test Hall",
            desc: "Test description",
          })
        }
      >
        Custom Event
      </span>
    </div>
  );
});

jest.mock("../components/UserEventPopup", () => ({ event, onClose }) => (
  <div>
    <div>Your Event</div>
    <div>{event.name}</div>
    <div>
      {event.allDay ? "All-day" : "2:00 PM - 3:00 PM"}
    </div>
    <button onClick={onClose}>Close</button>
  </div>
));

// Mocks for static assets like images
jest.mock("../assets/canvas.png", () => "canvas-icon-stub");
jest.mock("../assets/UNLVIcon.png", () => "unlv-icon-stub");
jest.mock("../assets/calIcon.png", () => "calendar-icon-stub");

// Mock Chrome APIs
global.chrome = {
  storage: {
    sync: {
      get: (keys, cb) => cb({ viewMode: "daily", openKeys: ["0", "1", "2"] }),
      set: jest.fn(),
    },
    local: {
      set: jest.fn(),
    },
  },
  runtime: {
    sendMessage: jest.fn(),
    onMessage: {
      addListener: jest.fn(),
      removeListener: jest.fn(),
    },
  },
};

// Mock fetch and filter events
jest.mock("../../public/scripts/fetch-events.js", () => ({
  fetchEvents: jest.fn().mockResolvedValue([
    [{ name: "AC Event" }],
    [{ name: "IC Event" }],
    [{ name: "RC Event" }],
    [{ name: "UC Event" }],
  ]),
  subscribeToUserEvents: (cb) => {
    cb([
      { title: "My Event", date: "2025-04-22", startTime: "14:00", allDay: false },
    ]);
    return () => {};
  },
  normalizeUserEvents: (events) =>
    events.map((e) => ({
      ...e,
      name: e.title,
      time: e.allDay ? "(ALL DAY)" : "2:00 PM",
      organization: "Your Event",
      link: "ignore",
    })),
}));

jest.mock("../../public/scripts/filter-events", () => ({
  filterEvents: jest.fn().mockResolvedValue([
    [{ name: "IC Event" }],
    [{ name: "RC Event" }],
    [{ name: "UC Event" }],
  ]),
}));

// ------------------------
// ✅ TESTS
// ------------------------

describe("AccordionMenu", () => {

  it("renders all three accordion sections (with images and text)", async () => {
    render(<AccordionMenu />);
    await waitFor(() => {
      expect(screen.getByText("Upcoming Assignments")).toBeInTheDocument();
      expect(screen.getByText("Your Events")).toBeInTheDocument();
      expect(screen.getByText("UNLV Events")).toBeInTheDocument();
    });
  });
  

  it("renders Events and CanvasAssignments components", async () => {
    render(<AccordionMenu />);
    expect(await screen.findByText("Canvas Assignments")).toBeInTheDocument();
    const events = await screen.findAllByTestId("custom-event");
    expect(events.length).toBeGreaterThan(0);
    expect(events[0]).toBeInTheDocument();
  });

  it("toggles view mode when Toggle button is clicked", async () => {
    render(<AccordionMenu />);
    const toggle = await screen.findByRole("button", { name: "Daily" });
    fireEvent.click(toggle);
    expect(toggle).toHaveTextContent("Weekly");
  });

  it("opens and closes the user event popup correctly", async () => {
    render(<AccordionMenu />);
    
    // Wait for accordion to load by finding the text
    await waitFor(() => {
      expect(screen.getByText("Upcoming Assignments")).toBeInTheDocument();
    });
  
    const customEvents = await screen.findAllByTestId("custom-event");
    fireEvent.click(customEvents[0]);
  
    expect(await screen.findByText("Your Event")).toBeInTheDocument();
    expect(screen.getByText("Test Event")).toBeInTheDocument();
    expect(screen.getByText("2:00 PM - 3:00 PM")).toBeInTheDocument();
  
    const closeButton = screen.getByText("Close");
    fireEvent.click(closeButton);
  
    await waitFor(() => {
      expect(screen.queryByText("Your Event")).not.toBeInTheDocument();
    });
  });
  

});
