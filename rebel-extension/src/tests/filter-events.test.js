import { filterEvents } from "../../public/scripts/filter-events";

jest.mock("../../public/scripts/fetch-events", () => ({
  fetchEvents: jest.fn(),
}));

const { fetchEvents } = require("../../public/scripts/fetch-events");

describe("filterEvents", () => {
  beforeEach(() => {
    jest.clearAllMocks();

    global.chrome = {
      storage: {
        sync: {
          get: jest.fn((keys, callback) => callback({
            selectedSports: ["Football"],
            selectedInterests: ["Career"],
            involvedClubs: ["Chess Club"],
            preferences: {
              rebelCoverage: true,
              UNLVCalendar: true,
              involvementCenter: true,
              academicCalendar: true,
            },
          })),
        },
        local: {
          get: jest.fn((keys, callback) => callback({ removedInvolvementCenterEvents: [] })),
        },
      },
    };
  });

  it("includes Rebel Sports events in the UNLV events bucket when that preference is enabled", async () => {
    fetchEvents.mockResolvedValue([
      [{ name: "Deadline" }],
      [{ name: "Club Night", organization: "Chess Club" }],
      [
        { name: "Football Game", sport: "Football" },
        { name: "Swim Meet", sport: "Swimming & Diving" },
      ],
      [{ name: "Career Fair", category: "Career" }],
    ]);

    const [, , filteredRC] = await filterEvents("2026-04-13", "daily");

    expect(filteredRC).toEqual([{ name: "Football Game", sport: "Football" }]);
  });

  it("excludes removed Involvement Center events", async () => {
    global.chrome.storage.local.get.mockImplementation((keys, callback) => callback({
      removedInvolvementCenterEvents: ["club night::2026-04-13::5:00 pm"],
    }));
    fetchEvents.mockResolvedValue([
      [],
      [
        { name: "Club Night", organization: "Chess Club", startDate: "2026-04-13", startTime: "5:00 PM" },
        { name: "Board Games", organization: "Chess Club", startDate: "2026-04-13", startTime: "6:00 PM" },
      ],
      [],
      [],
    ]);

    const [, filteredIC] = await filterEvents("2026-04-13", "daily");

    expect(filteredIC).toEqual([
      { name: "Board Games", organization: "Chess Club", startDate: "2026-04-13", startTime: "6:00 PM" },
    ]);
  });
});
