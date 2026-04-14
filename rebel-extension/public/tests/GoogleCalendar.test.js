/**
 * GoogleCalendar script Tests
 * 
 * This test suite validates the functionality of the Google Calendar interactions.
 * This script handles adding events to the user's Google Calendar.
 * 
 * Features Tested:
 * - Canvas access token can be properly fetched from Chrome storage.
 * - The course list for a given user is being retrieved properly.
 * - Assignments for a given course are being retrieved and handled properly.
 * 
 * Authored by: Gunnar Dalton
 */

import { getGoogleToken, getCalendarID, checkCalendarExists, getOrCreateCalendar, gatherEvents, eventHash, addOrUpdateEvents, getExistingEvents, deleteEvent, syncCalendar, importGoogleCalendarEvents } from "../scripts/GoogleCalendar";

beforeEach(() => {
    jest.clearAllMocks(); // Clear mocks between tests
    global.chrome = {
        identity: {
            getAuthToken: jest.fn()
        },
        runtime: {
            lastError: null
        },
        storage: {
          local: {
              get: jest.fn(),
              set: jest.fn((data, callback) => callback && callback()) 
          }
        }
      };
      global.fetch = jest.fn(); 
});

describe("getGoogleToken", () => {
    test("Get token successfully", async() => {
        const token = "test_token";
        chrome.identity.getAuthToken.mockImplementation((_, callback) => {
            chrome.runtime.lastError = null;
            callback(token);
        });

        const result = await getGoogleToken();
        expect(result).toBe(token);
    });

    test("Error getting token", async() => {
        chrome.identity.getAuthToken.mockImplementation((_, callback) => {
            chrome.runtime.lastError = { message: "test error" };
            callback(null);
        });

        const result = await getGoogleToken();
        expect(result).toBe(false);
    });
});

describe("getCalendarID", () => {
    test("Calendar ID is in storage", async() => {
        global.chrome.storage.local.get.mockImplementation((key, callback) => { 
            callback({ GoogleCalendarID: "test_calendarID" });
        });

        const result = await getCalendarID();
        expect(result).toBe("test_calendarID");
    });

    test("Calendar ID is not in storage", async() => {
        global.chrome.storage.local.get.mockImplementation((key, callback) => { 
            callback({});
        });

        const result = await getCalendarID();
        expect(result).toBe(false);
    });
});

describe("checkCalendarExists", () => {
    test("Calendar with specified calendarID exists", async() => {
        fetch.mockResolvedValueOnce({
            ok: true,
        });

        const result = await checkCalendarExists("test_token", "test_calendarID");
        expect(result).toBe(true);
    });

    test("Calendar with specified calendarID does not exist", async() => {
        fetch.mockResolvedValueOnce({
            ok: false,
            status: 404
        });

        const result = await checkCalendarExists("test_token", "test_calendarID");
        expect(result).toBe(false);
    });
});

describe("getOrCreateCalendar", () => {
    test("Calendar is found", async() => {
        fetch.mockResolvedValueOnce({
            ok: true,
            json: async() => ({ items: [
                { summary: "My Calendar", id: "wrong_calendarID" },
                { summary: "Rebel Remind", id: "correct_calendarID" }
            ]})
        });

        const result = await getOrCreateCalendar("test_token");
        expect(chrome.storage.local.set).toHaveBeenCalledWith({ GoogleCalendarID: "correct_calendarID" });
        expect(result).toBe("correct_calendarID");
    });

    test("Calendar needs to be created", async() => {
        fetch.mockResolvedValueOnce({
            ok: true,
            json: async() => ({ items: [
                { summary: "My Calendar", id: "wrong_calendarID" }
            ]})
        });
        fetch.mockResolvedValueOnce({
            ok: true,
            json: async() => ({ id: "correct_calendarID" })
        });

        const result = await getOrCreateCalendar("test_token");
        expect(chrome.storage.local.set).toHaveBeenCalledWith({ GoogleCalendarID: "correct_calendarID" });
        expect(result).toBe("correct_calendarID");
    });
});

describe("gatherEvents", () => {
    test("Get Canvas events only", async() => {
        global.chrome.storage.local.get.mockImplementation((key, callback) => { 
            callback({ Canvas_Assignments: [
                { due_at: "2025-03-31T07:59:59Z", title: "Assignment 1", context_name: "CS 101", id: 1234 }, 
                { due_at: "2025-04-17T00:29:00Z", title: "Assignment 2", context_name: "CS 102", id: 3485 },
                { due_at: "2025-04-30T23:29:00Z", title: "Assignment 3", context_name: "CS 103", id: 3092 },
                { due_at: null, title: "Assignment 4", context_name: "CS 104", id: 5928 }
             ]});
        });

        const result = await gatherEvents();
        expect(result).toEqual([
            { summary: "Assignment 1", description: "CS 101", id: "assignment1234", start: { dateTime: "2025-03-31T07:59:59Z", timeZone: "America/Los_Angeles" }, end: { dateTime: "2025-03-31T07:59:59Z", timeZone: "America/Los_Angeles" }, extendedProperties: { private: { managedBy: "Rebel Remind" }} },
            { summary: "Assignment 2", description: "CS 102", id: "assignment3485", start: { dateTime: "2025-04-17T00:29:00Z", timeZone: "America/Los_Angeles" }, end: { dateTime: "2025-04-17T00:29:00Z", timeZone: "America/Los_Angeles" }, extendedProperties: { private: { managedBy: "Rebel Remind" }} },
            { summary: "Assignment 3", description: "CS 103", id: "assignment3092", start: { dateTime: "2025-04-30T23:29:00Z", timeZone: "America/Los_Angeles" }, end: { dateTime: "2025-04-30T23:29:00Z", timeZone: "America/Los_Angeles" }, extendedProperties: { private: { managedBy: "Rebel Remind" }} }
        ]);
    });

    test("Get user events only", async() => {
        global.chrome.storage.local.get.mockImplementation((key, callback) => { 
            callback({ userEvents: [
                { allDay: false, date: "2025-04-30", desc: "Tom's Birthday Party, don't forget a present", endTime: "22:00", startDate: "2025-04-30", startTime: "20:00", title: "Birthday Party", location: "Tom's House" },
                { allDay: true, desc: "Study Hard", location: "", endTime: "", startDate: "2025-04-28", startTime: "", title: "Final Exams" }
             ]});
        });

        const result = await gatherEvents();
        expect(result).toEqual([
            { summary: "Birthday Party", id: expect.any(String), description: "Tom's Birthday Party, don't forget a present", location: "Tom's House", start: { dateTime: "2025-04-30T20:00:00", timeZone: "America/Los_Angeles" }, end: { dateTime: "2025-04-30T22:00:00", timeZone: "America/Los_Angeles"}, extendedProperties: { private: { managedBy: "Rebel Remind" }} },
            { summary: "Final Exams", id: expect.any(String), description: "Study Hard", location: "", start: { date: "2025-04-28", timeZone: "America/Los_Angeles" }, end: { date: "2025-04-28", timeZone: "America/Los_Angeles" }, extendedProperties: { private: { managedBy: "Rebel Remind" }} }
        ]);
    });

    test("Get Involvement Center events only", async() => {
        global.chrome.storage.local.get.mockImplementation((key, callback) => { 
            callback({ filteredIC: [
                { name: "Monthly Meeting", organization: "Layer Zero", location: "TBE B174", startDate: "2025-05-05", endDate: "2025-05-05", startTime: "5:30 PM", endTime: "7:30 PM"}
             ]});
        });

        const result = await gatherEvents();
        expect(result).toEqual([
            { summary: "Monthly Meeting", description: "Layer Zero", location: "TBE B174", id: expect.any(String), start: { dateTime: (new Date("2025-05-05 5:30 PM")).toISOString() }, end: { dateTime: (new Date("2025-05-05 7:30 PM")).toISOString() }, extendedProperties: { private: { managedBy: "Rebel Remind" }} }
        ]);
    });

    test("Get UNLV events only", async() => {
        global.chrome.storage.local.get.mockImplementation((key, callback) => { 
            callback({ savedUNLVEvents: [
                { name: "Tech Seminar", location: "CHB A106", startDate: "2025-04-29", startTime: "2:30 PM", endDate: "2025-04-29", endTime: "6:30 PM" },
                { name: "School Holiday", location: "", startDate: "2025-05-07", startTime: "(ALL DAY)", endTime: "", endDate: "2025-05-07" },
                { name: "Baseball at San Jose State", location: null, startDate: "2025-05-02", startTime: "2:05 PM", endTime: "", endDate: "2025-05-02" }
             ]});
        });

        const result = await gatherEvents();
        expect(result).toEqual([
            { summary: "Tech Seminar", id: expect.any(String), location: "CHB A106", start: { dateTime: (new Date("2025-04-29 2:30 PM")).toISOString() }, end: { dateTime: (new Date("2025-04-29 6:30 PM")).toISOString() }, extendedProperties: { private: { managedBy: "Rebel Remind" }} },
            { summary: "School Holiday", location: "", id: expect.any(String), start: { date: "2025-05-07" }, end: { date: "2025-05-07" }, extendedProperties: { private: { managedBy: "Rebel Remind" }} },
            { summary: "Baseball at San Jose State", id: expect.any(String), location: null, start: { dateTime: (new Date("2025-05-02 2:05 PM")).toISOString() }, end: { dateTime: (new Date("2025-05-02 2:05 PM")).toISOString() }, extendedProperties: { private: { managedBy: "Rebel Remind" }} }
        ]);
    });
});

describe("eventHash", () => {
    test("Hash is calculated for a given event", async() => {
        expect(typeof eventHash("test_title", "2025-05-05")).toBe('number');
        expect(eventHash("test_title", "2025-05-05")).toBeGreaterThanOrEqual(0);
    });
});

describe("addOrUpdateEvents", () => {
    test("Event is new", async() => {
        fetch.mockResolvedValueOnce({
            ok: true
        });
        const testEvent = { summary: "Final Exams", id: "unlvevent2960", description: "Study Hard", location: "", start: { date: "2025-04-28", timeZone: "America/Los_Angeles" }, end: { date: "2025-04-28", timeZone: "America/Los_Angeles" }, extendedProperties: { private: { managedBy: "Rebel Remind" }} };

        await addOrUpdateEvents("test_token", "test_calendarID", testEvent);
        expect(fetch).toHaveBeenCalledTimes(1);
    });

    test("Event needs an update", async() => {
        fetch.mockResolvedValueOnce({
            ok: false,
            status: 409
        });
        fetch.mockResolvedValueOnce({
            ok: true
        });
        const testEvent = { summary: "Final Exams", id: "unlvevent2960", description: "Study Hard", location: "", start: { date: "2025-04-28", timeZone: "America/Los_Angeles" }, end: { date: "2025-04-28", timeZone: "America/Los_Angeles" }, extendedProperties: { private: { managedBy: "Rebel Remind" }} };

        await addOrUpdateEvents("test_token", "test_calendarID", testEvent);
        expect(fetch).toHaveBeenCalledTimes(2);
    });
});

describe("getExistingEvents", () => {
    test("List of events is filtered properly", async() => {
        fetch.mockResolvedValueOnce({
            ok: true,
            json: async() => ({ items: [
                { summary: "Tech Seminar", id: "unlvevent2345", location: "CHB A106", start: { dateTime: (new Date("2025-04-29 2:30 PM")).toISOString() }, end: { dateTime: (new Date("2025-04-29 6:30 PM")).toISOString() }, extendedProperties: { private: { managedBy: "Rebel Remind" }} },
                { summary: "School Holiday", location: "", id: "unlvevent9342", start: { date: "2025-05-07" }, end: { date: "2025-05-07" } },
                { summary: "Baseball at San Jose State", id: "unlvevent5623", location: null, start: { dateTime: (new Date("2025-05-02 2:05 PM")).toISOString() }, end: { dateTime: (new Date("2025-05-02 2:05 PM")).toISOString() }, extendedProperties: { private: { managedBy: "Rebel Remind" }} }
            ]})
        });

        const result = await getExistingEvents("test_token", "test_calendarID");
        expect(result).toEqual([
            { summary: "Tech Seminar", id: "unlvevent2345", location: "CHB A106", start: { dateTime: (new Date("2025-04-29 2:30 PM")).toISOString() }, end: { dateTime: (new Date("2025-04-29 6:30 PM")).toISOString() }, extendedProperties: { private: { managedBy: "Rebel Remind" }} },
            { summary: "Baseball at San Jose State", id: "unlvevent5623", location: null, start: { dateTime: (new Date("2025-05-02 2:05 PM")).toISOString() }, end: { dateTime: (new Date("2025-05-02 2:05 PM")).toISOString() }, extendedProperties: { private: { managedBy: "Rebel Remind" }} }
        ]);
    });

    test("No events in list", async() => {
        fetch.mockResolvedValueOnce({
            ok: true,
            json: async() => ({ items: []})
        });

        const result = await getExistingEvents("test_token", "test_calendarID");
        expect(result).toEqual([]);
    });
});

describe("deleteEvent", () => {
    test("Delete an event", async() => {
        fetch.mockResolvedValueOnce({
            ok: true
        });

        const testEvent = { summary: "Final Exams", id: "unlvevent2960", description: "Study Hard", location: "", start: { date: "2025-04-28", timeZone: "America/Los_Angeles" }, end: { date: "2025-04-28", timeZone: "America/Los_Angeles" }, extendedProperties: { private: { managedBy: "Rebel Remind" }} };
        await deleteEvent("test_token", "test_calendarID", testEvent.id);
        expect(fetch).toHaveBeenCalledTimes(1);
    });
});

describe("syncCalendar", () => {
    test("Add new event to calendar", async() => {
        fetch.mockResolvedValueOnce({
            ok: true,
            json: async() => ({ items: [
                { summary: "Tech Seminar", id: "unlvevent2345", location: "CHB A106", start: { dateTime: (new Date("2025-04-29 2:30 PM")).toISOString() }, end: { dateTime: (new Date("2025-04-29 6:30 PM")).toISOString() }, extendedProperties: { private: { managedBy: "Rebel Remind" }} },
                { summary: "School Holiday", location: "", id: "unlvevent9342", start: { date: "2025-05-07" }, end: { date: "2025-05-07" }, extendedProperties: { private: { managedBy: "Rebel Remind" }} }
            ]})
        });
        fetch.mockResolvedValueOnce({
            ok: false,
            status: 409
        });
        fetch.mockResolvedValueOnce({
            ok: true
        });
        fetch.mockResolvedValueOnce({
            ok: false,
            status: 409
        });
        fetch.mockResolvedValueOnce({
            ok: true
        });
        fetch.mockResolvedValueOnce({
            ok: true
        });
        const testEvents = [
            { summary: "Tech Seminar", id: "unlvevent2345", location: "CHB A106", start: { dateTime: (new Date("2025-04-29 2:30 PM")).toISOString() }, end: { dateTime: (new Date("2025-04-29 6:30 PM")).toISOString() }, extendedProperties: { private: { managedBy: "Rebel Remind" }} },
            { summary: "School Holiday", location: "", id: "unlvevent9342", start: { date: "2025-05-07" }, end: { date: "2025-05-07" } },
            { summary: "Baseball at San Jose State", id: "unlvevent5623", location: null, start: { dateTime: (new Date("2025-05-02 2:05 PM")).toISOString() }, end: { dateTime: (new Date("2025-05-02 2:05 PM")).toISOString() }, extendedProperties: { private: { managedBy: "Rebel Remind" }} }
        ];

        await syncCalendar(testEvents, "test_token", "test_calendarID");
        expect(fetch).toHaveBeenCalledTimes(6);
    });

    test("Delete an old event", async() => {
        fetch.mockResolvedValueOnce({
            ok: true,
            json: async() => ({ items: [
                { summary: "Tech Seminar", id: "unlvevent2345", location: "CHB A106", start: { dateTime: (new Date("2025-04-29 2:30 PM")).toISOString() }, end: { dateTime: (new Date("2025-04-29 6:30 PM")).toISOString() }, extendedProperties: { private: { managedBy: "Rebel Remind" }} },
                { summary: "School Holiday", location: "", id: "unlvevent9342", start: { date: "2025-05-07" }, end: { date: "2025-05-07" }, extendedProperties: { private: { managedBy: "Rebel Remind" }} },
                { summary: "Baseball at San Jose State", id: "unlvevent5623", location: null, start: { dateTime: (new Date("2025-05-02 2:05 PM")).toISOString() }, end: { dateTime: (new Date("2025-05-02 2:05 PM")).toISOString() }, extendedProperties: { private: { managedBy: "Rebel Remind" }} }
            ]})
        });
        fetch.mockResolvedValueOnce({
            ok: true
        });
        fetch.mockResolvedValueOnce({
            ok: false,
            status: 409
        });
        fetch.mockResolvedValueOnce({
            ok: true
        });
        fetch.mockResolvedValueOnce({
            ok: false,
            status: 409
        });
        fetch.mockResolvedValueOnce({
            ok: true
        });
        const testEvents = [
            { summary: "Tech Seminar", id: "unlvevent2345", location: "CHB A106", start: { dateTime: (new Date("2025-04-29 2:30 PM")).toISOString() }, end: { dateTime: (new Date("2025-04-29 6:30 PM")).toISOString() }, extendedProperties: { private: { managedBy: "Rebel Remind" }} },
            { summary: "School Holiday", location: "", id: "unlvevent9342", start: { date: "2025-05-07" }, end: { date: "2025-05-07" }, extendedProperties: { private: { managedBy: "Rebel Remind" }} }
        ];

        await syncCalendar(testEvents, "test_token", "test_calendarID");
        expect(fetch).toHaveBeenCalledTimes(6);
    });
});

describe("importGoogleCalendarEvents", () => {
    test("imports non-Rebel-Remind Google Calendar events into local storage", async() => {
        fetch.mockResolvedValueOnce({
            ok: true,
            json: async() => ({
                items: [
                    {
                        id: "google-1",
                        summary: "Doctor Appointment",
                        description: "Annual checkup",
                        location: "Clinic",
                        htmlLink: "https://calendar.google.com/event?eid=1",
                        start: { dateTime: "2026-04-15T16:30:00Z" },
                        end: { dateTime: "2026-04-15T17:00:00Z" },
                    },
                    {
                        id: "rr-managed",
                        summary: "Rebel Remind Event",
                        start: { dateTime: "2026-04-16T16:30:00Z" },
                        end: { dateTime: "2026-04-16T17:00:00Z" },
                        extendedProperties: { private: { managedBy: "Rebel Remind" } }
                    }
                ]
            })
        });

        const result = await importGoogleCalendarEvents("test_token");

        expect(result).toHaveLength(1);
        expect(result[0]).toMatchObject({
            title: "Doctor Appointment",
            desc: "Annual checkup",
            location: "Clinic",
            link: "https://calendar.google.com/event?eid=1",
            googleEventId: "google-1",
        });
        expect(chrome.storage.local.set).toHaveBeenCalledWith({ googleCalendarEvents: result }, expect.any(Function));
    });
});
// describe("getAssignments", () => {
//     test("Fetch Assignment List (Single Page)", async () => {
//         // ai-gen start (ChatGPT-4o, 2)
//         fetch.mockResolvedValueOnce({
//             ok: true,
//             json: async () => [{ assignment: {due_at: "2025-03-03"}, title: "Assignment 1", context_name: "CS 101" }, // fake assignments to fetch
//                 { assignment: {due_at: "2025-04-01"}, title: "Assignment 2", context_name: "CS 102" },
//                 { assignment: {due_at: "2025-03-25"}, title: "Assignment 3", context_name: "CS 103" }],
//             headers: { get: () => null }
//         });
//         const result = await getAssignments(12345, "test_access_token");
//         expect(result).toEqual([{"context_name": "CS 101", "due_at": "2025-03-03", "title": "Assignment 1"}, {"context_name": "CS 102", "due_at": "2025-04-01", "title": "Assignment 2"}, {"context_name": "CS 103", "due_at": "2025-03-25", "title": "Assignment 3"}])
//         expect(fetch).toHaveBeenCalledTimes(1);
//         expect(fetch).toHaveBeenCalledWith("https://unlv.instructure.com/api/v1/calendar_events?type=assignment&all_events=true&per_page=100&context_codes[]=course_12345", expect.any(Object));
//         // ai-gen end
//     });

//     test("Fetch Assignment List (Multi Page)", async () => {
//         fetch
//             .mockResolvedValueOnce({ // first page
//                 ok: true,
//                 json: async () => [{ assignment: {due_at: "2025-03-03"}, title: "Assignment 4", context_name: "CS 104" }, 
//                     { assignment: {due_at: "2025-04-01"}, title: "Assignment 5", context_name: "CS 105" },
//                     { assignment: {due_at: "2025-03-25"}, title: "Assignment 6", context_name: "CS 106" }],
//                 headers: { get: () => '<https://unlv.instructure.com/api/v1/calendar_events?type=assignment&all_events=true&context_codes[]=course_12345&page=2&per_page=100>; rel="next"'}
//             })
//             .mockResolvedValueOnce({ // second page
//                 ok: true,
//                 json: async () => [{ assignment: {due_at: "2025-03-03"}, title: "Assignment 1", context_name: "CS 101" }, 
//                     { assignment: {due_at: "2025-04-01"}, title: "Assignment 2", context_name: "CS 102" },
//                     { assignment: {due_at: "2025-03-25"}, title: "Assignment 3", context_name: "CS 103" }],
//                 headers: { get: () => null }
//             });
//         const result = await getAssignments(12345, "test_access_token");
//         expect(result).toEqual([{"context_name": "CS 104", "due_at": "2025-03-03", "title": "Assignment 4"},
//             {"context_name": "CS 105", "due_at": "2025-04-01", "title": "Assignment 5"},
//             {"context_name": "CS 106", "due_at": "2025-03-25", "title": "Assignment 6"},
//             {"context_name": "CS 101", "due_at": "2025-03-03", "title": "Assignment 1"}, 
//             {"context_name": "CS 102", "due_at": "2025-04-01", "title": "Assignment 2"}, 
//             {"context_name": "CS 103", "due_at": "2025-03-25", "title": "Assignment 3"}])
//         expect(fetch).toHaveBeenCalledTimes(2);
//         expect(fetch).toHaveBeenCalledWith("https://unlv.instructure.com/api/v1/calendar_events?type=assignment&all_events=true&per_page=100&context_codes[]=course_12345", expect.any(Object));
//         expect(fetch).toHaveBeenCalledWith("https://unlv.instructure.com/api/v1/calendar_events?type=assignment&all_events=true&context_codes[]=course_12345&page=2&per_page=100", expect.any(Object))
//     });

//     test("Bad Access Token", async () => { // check for bad API response
//         const consoleLogSpy = jest.spyOn(console, "log").mockImplementation(() => {});
//         fetch.mockResolvedValueOnce({
//             ok: false, 
//             status: 401,
//             json: async () => ({ error: "Unauthorized" })
//         })
//         const result = await getAssignments(12345, "bad_access_token")
//         expect(consoleLogSpy).toHaveBeenCalledWith(
//             expect.stringContaining("Error fetching assignments:"), 
//             expect.any(Error) 
//         );
//         consoleLogSpy.mockRestore();
//     });

//     test("Bad link to second page of assignment list", async() => {
//         fetch
//             .mockResolvedValueOnce({ // first page
//                 ok: true,
//                 json: async () => [{ assignment: {due_at: "2025-03-03"}, title: "Assignment 4", context_name: "CS 104" }, 
//                     { assignment: {due_at: "2025-04-01"}, title: "Assignment 5", context_name: "CS 105" },
//                     { assignment: {due_at: "2025-03-25"}, title: "Assignment 6", context_name: "CS 106" }],
//                 headers: { get: () => '<https://bad_link.com>; rel="bad"'}
//             })
//             .mockResolvedValueOnce({ // second page
//                 ok: true,
//                 json: async () => [{ assignment: {due_at: "2025-03-03"}, title: "Assignment 1", context_name: "CS 101" }, 
//                     { assignment: {due_at: "2025-04-01"}, title: "Assignment 2", context_name: "CS 102" },
//                     { assignment: {due_at: "2025-03-25"}, title: "Assignment 3", context_name: "CS 103" }],
//                 headers: { get: () => null }
//             });
//         const result = await getAssignments(12345, "test_access_token");
//         expect(result).toEqual([{"context_name": "CS 104", "due_at": "2025-03-03", "title": "Assignment 4"},
//             {"context_name": "CS 105", "due_at": "2025-04-01", "title": "Assignment 5"},
//             {"context_name": "CS 106", "due_at": "2025-03-25", "title": "Assignment 6"}])
//         expect(fetch).toHaveBeenCalledTimes(1);
//         expect(fetch).toHaveBeenCalledWith("https://unlv.instructure.com/api/v1/calendar_events?type=assignment&all_events=true&per_page=100&context_codes[]=course_12345", expect.any(Object));
//     });
// });

// describe("getCourses", () => {
//     test("Fetch Course List (Single Page)", async () => {
//         fetch.mockResolvedValueOnce({
//                 ok: true,
//                 json: async () => [{ id: 1, name: "CS 101", access_restricted_by_date: true }, // fake course list
//                     { id: 2, name: "CS 102", access_restricted_by_date: false }, 
//                     { id: 3, name: "CS 103", access_restricted_by_date: false }, 
//                     { id: 4, name: "CS 104", access_restricted_by_date: true }],
//                 headers: { get: () => null }
//         });
//         const result = await getCourses("test_access_token");
//         expect(result).toEqual([2, 3]); // get only active courses
//         expect(fetch).toHaveBeenCalledTimes(1);
//         expect(fetch).toHaveBeenCalledWith("https://unlv.instructure.com/api/v1/courses?per_page=100", expect.any(Object));
//     });

//     test("Fetch Course List (Multi Page)", async () => {
//         fetch
//         .mockResolvedValueOnce({ // first page
//                 ok: true,
//                 json: async () => [{ id: 1, name: "CS 101", access_restricted_by_date: true }, 
//                     { id: 2, name: "CS 102", access_restricted_by_date: false }, 
//                     { id: 3, name: "CS 103", access_restricted_by_date: true }, 
//                     { id: 4, name: "CS 104", access_restricted_by_date: true }],
//                     headers: { get: () => '<https://unlv.instructure.com/api/v1/courses?page=2&per_page=100>; rel="next"'}
//             })
//         .mockResolvedValueOnce({ // second page
//                 ok: true,
//                 json: async () => [{ id: 5, name: "CS 105", access_restricted_by_date: false },
//                     { id: 6, name: "CS 106", access_restricted_by_date: false },
//                     { id: 7, name: "CS 107", access_restricted_by_date: true },
//                     { id: 8, name: "CS 108", access_restricted_by_date: true }],
//                     headers: { get: () => null}
//             });
//             const result = await getCourses("test_access_token");
//             expect(result).toEqual([2, 5, 6]); // get only active courses
//             expect(fetch).toHaveBeenCalledTimes(2);
//             expect(fetch).toHaveBeenCalledWith("https://unlv.instructure.com/api/v1/courses?per_page=100", expect.any(Object));
//             expect(fetch).toHaveBeenCalledWith("https://unlv.instructure.com/api/v1/courses?page=2&per_page=100", expect.any(Object));
//     });

//     test("Bad Access Token", async () => { // check for bad API response
//         const consoleLogSpy = jest.spyOn(console, "log").mockImplementation(() => {});
//         fetch.mockResolvedValueOnce({
//             ok: false, 
//             status: 401,
//             json: async () => ({ error: "Unauthorized" })
//         })
//         const result = await getCourses("bad_access_token");
//         expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining("There may be an issue with your Canvas Access Token. Please check that and try again!"));
//         expect(consoleLogSpy).toHaveBeenCalledWith(
//             expect.stringContaining("Error fetching courses:"), 
//             expect.any(Error) 
//         );
//         consoleLogSpy.mockRestore();
//     });

//     test("Bad link to second page of course list", async() => {
//         fetch
//         .mockResolvedValueOnce({ // first page
//                 ok: true,
//                 json: async () => [{ id: 1, name: "CS 101", access_restricted_by_date: true }, 
//                     { id: 2, name: "CS 102", access_restricted_by_date: false }, 
//                     { id: 3, name: "CS 103", access_restricted_by_date: true }, 
//                     { id: 4, name: "CS 104", access_restricted_by_date: true }],
//                     headers: { get: () => '<https://bad_link.com>; rel="bad"'}
//             })
//         .mockResolvedValueOnce({ // second page
//                 ok: true,
//                 json: async () => [{ id: 5, name: "CS 105", access_restricted_by_date: false },
//                     { id: 6, name: "CS 106", access_restricted_by_date: false },
//                     { id: 7, name: "CS 107", access_restricted_by_date: true },
//                     { id: 8, name: "CS 108", access_restricted_by_date: true }],
//                     headers: { get: () => null}
//             });
//             const result = await getCourses("test_access_token");
//             expect(result).toEqual([2]); // get only active courses
//             expect(fetch).toHaveBeenCalledTimes(1);
//             expect(fetch).toHaveBeenCalledWith("https://unlv.instructure.com/api/v1/courses?per_page=100", expect.any(Object));
//     });

//     test("Non 401 error received", async() => {
//         const consoleLogSpy = jest.spyOn(console, "log").mockImplementation(() => {});
//         fetch.mockResolvedValueOnce({
//             ok: false, 
//             status: 404,
//             json: async () => ({ error: "Not Found" })
//         })
//         const result = await getCourses("bad_access_token");
//         expect(consoleLogSpy).toHaveBeenCalledWith(
//             expect.stringContaining("Error fetching courses:"), 
//             expect.any(Error) 
//         );
//         consoleLogSpy.mockRestore();
//     });

//     test("Add all new courses to color list", async() => {
//         fetch.mockResolvedValueOnce({
//             ok: true,
//             json: async () => [{ id: 1, name: "CS 101", access_restricted_by_date: true }, // fake course list
//                 { id: 2, name: "CS 102", access_restricted_by_date: false }, 
//                 { id: 3, name: "CS 103", access_restricted_by_date: false }, 
//                 { id: 4, name: "CS 104", access_restricted_by_date: true }],
//             headers: { get: () => null }
//         });
//         global.chrome.storage.local.get.mockImplementation((key, callback) => { 
//             callback({ colorList: { UNLVEvents: "#b10202", InvolvementCenter: "#666666", userEvents: "#0000ff", CanvasCourses: {} }});
//         })
//         const result = await getCourses("test_access_token");

//         expect(chrome.storage.local.set).toHaveBeenCalledWith({ colorList: { UNLVEvents: "#b10202", InvolvementCenter: "#666666", userEvents: "#0000ff", CanvasCourses: {
//             2: { color: expect.any(String), name: "CS 102"},
//             3: { color: expect.any(String), name: "CS 103"}
//         } }});
//     });

//     test("Add a new course to color list", async() => {
//         fetch.mockResolvedValueOnce({
//             ok: true,
//             json: async () => [{ id: 1, name: "CS 101", access_restricted_by_date: true }, // fake course list
//                 { id: 2, name: "CS 102", access_restricted_by_date: false }, 
//                 { id: 3, name: "CS 103", access_restricted_by_date: false }, 
//                 { id: 4, name: "CS 104", access_restricted_by_date: false }],
//             headers: { get: () => null }
//         });
//         global.chrome.storage.local.get.mockImplementation((key, callback) => { 
//             callback({ colorList: { UNLVEvents: "#b10202", InvolvementCenter: "#666666", userEvents: "#0000ff", CanvasCourses: { 2: { color: "#333333", name: "CS 102" } } }});
//         })
//         const result = await getCourses("test_access_token");

//         expect(chrome.storage.local.set).toHaveBeenCalledWith({ colorList: { UNLVEvents: "#b10202", InvolvementCenter: "#666666", userEvents: "#0000ff", CanvasCourses: {
//             2: { color: "#333333", name: "CS 102"},
//             3: { color: expect.any(String), name: "CS 103"},
//             4: { color: expect.any(String), name: "CS 104"}
//         } }});
//     });
// });

// describe("generateInitialColor", () => {
//     // ai-gen start (ChatGPT-4o, 1)
//     test("Color is calculated as a hex color for a course", async() => {
//         expect(generateInitialColor(12345)).toMatch(/^#[0-9a-fA-F]{6}$/);
//     });

//     test("All cases of h values are tested", async() => {
//         expect(generateInitialColor(1089)).toMatch(/^#[0-9a-fA-F]{6}$/);
//         expect(generateInitialColor(1000)).toMatch(/^#[0-9a-fA-F]{6}$/);
//         expect(generateInitialColor(1010)).toMatch(/^#[0-9a-fA-F]{6}$/);
//         expect(generateInitialColor(1030)).toMatch(/^#[0-9a-fA-F]{6}$/);
//         expect(generateInitialColor(1050)).toMatch(/^#[0-9a-fA-F]{6}$/);
//         expect(generateInitialColor(1070)).toMatch(/^#[0-9a-fA-F]{6}$/);
//     });
//     // ai-gen end
// });
