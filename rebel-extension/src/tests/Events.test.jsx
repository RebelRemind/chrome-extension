import { render, screen, fireEvent, waitFor,act, within } from '@testing-library/react';
import Events from '../components/Events';

beforeAll(() => {
  global.chrome = {
    storage: {
      local: {
        get: jest.fn(),
        set: jest.fn()
      }
    },
    runtime: {
      sendMessage: jest.fn(),
      onMessage: {
        addListener: jest.fn(),
        removeListener: jest.fn()
      }
    }
  };
  global.alert = jest.fn();
});

describe('Events component', () => {
  const mockDailyEvents = [
    { id: 1, name: 'Event A', startTime: '10:00 AM', link: 'https://example.com', organization: 'Org A', startDate: '2025-04-21' },
    { id: 2, name: 'Event B', startTime: '2:00 PM', link: 'https://example.com', organization: 'Org B', startDate: '2025-04-21' },
  ];

  const mockWeeklyEvents = [
    {
      id: 1,
      name: 'Weekly Event Sunday',
      startTime: '1:00 PM',
      link: 'https://example.com',
      organization: 'Org A',
      startDate: '2025-04-20',
    },
    {
      id: 2,
      name: 'Weekly Event Monday',
      startTime: '3:00 PM',
      link: 'https://example.com',
      organization: 'Org B',
      startDate: '2025-04-21',
    },
  ];

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('displays a message when no events are provided', () => {
    render(<Events events={[]} viewMode="daily" />);
    expect(screen.getByText(/no events found/i)).toBeInTheDocument();
  });

  it('renders a list of daily events correctly', () => {
    global.chrome.storage.local.get.mockImplementation((key, callback) => {
      callback({ savedUNLVEvents: [] });
    });

    render(<Events events={mockDailyEvents} viewMode="daily" />);
    expect(screen.getByText(/Event A/i)).toBeInTheDocument();
    expect(screen.getByText(/Event B/i)).toBeInTheDocument();
    expect(screen.getAllByRole('link')).toHaveLength(2);
  });

  it('groups and renders events by weekday when in weekly view', () => {
    global.chrome.storage.local.get.mockImplementation((key, callback) => {
      callback({ savedUNLVEvents: [] });
    });

    render(<Events events={mockWeeklyEvents} viewMode="weekly" />);
    expect(screen.getByText('Sunday')).toBeInTheDocument();
    expect(screen.getByText('Monday')).toBeInTheDocument();
    expect(screen.getByText(/Weekly Event Sunday/i)).toBeInTheDocument();
    expect(screen.getByText(/Weekly Event Monday/i)).toBeInTheDocument();
  });

  it('adds an event to calendar when Add button is clicked', async () => {
    global.chrome.storage.local.get.mockImplementation((key, callback) => {
      callback({ savedUNLVEvents: [] });
    });

    global.chrome.storage.local.set.mockImplementation((data, callback) => callback());

    render(<Events events={mockDailyEvents} viewMode="daily" />);

    const addButtons = await screen.findAllByLabelText('add to calendar');
    fireEvent.click(addButtons[0]);

    expect(global.chrome.storage.local.set).toHaveBeenCalled();
    expect(global.chrome.runtime.sendMessage).toHaveBeenCalledWith({ type: "EVENT_UPDATED" });
  });

  it('removes an event from calendar when Remove button is clicked', async () => {
    const eventWithAdded = { ...mockDailyEvents[0], added: true };
    global.chrome.storage.local.get.mockImplementation((key, callback) => {
      callback({ savedUNLVEvents: [eventWithAdded] });
    });

    global.chrome.storage.local.set.mockImplementation((data, callback) => callback());

    render(<Events events={[eventWithAdded]} viewMode="daily" />);

    const removeButton = await screen.findByLabelText('remove from calendar');
    fireEvent.click(removeButton);

    await waitFor(() =>
      expect(global.chrome.runtime.sendMessage).toHaveBeenCalledWith({ type: "EVENT_UPDATED" })
    );
  });

  it('renders academic calendar events correctly', () => {
    const academicEvent = [
      { id: 3, name: 'Finals Week', startDate: '2025-05-10', startTime: '', link: '', academicCalendar: true }
    ];
    global.chrome.storage.local.get.mockImplementation((key, callback) => {
      callback({ savedUNLVEvents: [] });
    });

    render(<Events events={academicEvent} viewMode="daily" />);
    expect(screen.getByText(/academic calendar/i)).toBeInTheDocument();
    expect(screen.getByText(/Finals Week/i)).toBeInTheDocument();
  });

  it('reacts to EVENT_UPDATED message by reloading events from storage', async () => {
    const updatedEvent = {
      id: 5,
      name: 'New Event',
      startDate: '2025-04-22',
      startTime: '5:00 PM',
      link: 'https://example.com',
      organization: 'Org C'
    };
  
    const getMock = jest.fn((key, callback) => {
      callback({ savedUNLVEvents: [updatedEvent] });
    });
  
    global.chrome.storage.local.get = getMock;
    global.chrome.runtime.onMessage.addListener = jest.fn((listener) => {
      // Store the listener for later use
      global.__mockedListener__ = listener;
    });
  
    render(<Events events={[updatedEvent]} viewMode="daily" />);
  
    // Simulate sending a runtime message of type EVENT_UPDATED
    act(() => {
      global.__mockedListener__({ type: 'EVENT_UPDATED' });
    });
  
    // Verify that storage.get was called again to update state
    expect(getMock).toHaveBeenCalledWith("savedUNLVEvents", expect.any(Function));
  });
  
  it('calls setActiveEventPopup when a custom event is clicked', () => {
    const mockEvent = {
      id: 10,
      name: 'Custom Meetup',
      time: '6:00 PM',
      organization: 'Cool Club',
      startDate: '2025-04-22',
      startTime: '6:00 PM',
      link: 'customEvent',
      added: false
    };
  
    const setActiveEventPopup = jest.fn();
  
    global.chrome.storage.local.get.mockImplementation((key, callback) => {
      callback({ savedUNLVEvents: [] });
    });
  
    render(
      <Events
        events={[mockEvent]}
        viewMode="daily"
        setActiveEventPopup={setActiveEventPopup}
      />
    );
  
    const eventLink = screen.getByText('Custom Event: Custom Meetup').closest('a');
    fireEvent.click(eventLink);
  
    expect(setActiveEventPopup).toHaveBeenCalledWith(mockEvent);
  });

  it('prefixes custom events with Custom Event', () => {
    const mockEvent = {
      id: 11,
      name: 'Study Group',
      time: '7:00 PM',
      organization: 'Your Event',
      startDate: '2025-04-22',
      startTime: '7:00 PM',
      link: 'customEvent',
    };

    global.chrome.storage.local.get.mockImplementation((key, callback) => {
      callback({ savedUNLVEvents: [] });
    });

    render(<Events events={[mockEvent]} viewMode="daily" setActiveEventPopup={jest.fn()} />);

    expect(screen.getByText('Custom Event: Study Group')).toBeInTheDocument();
  });
  
  
});
