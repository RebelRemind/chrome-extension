import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import SidePanelButton from "../components/SidePanelButton";

// Mock Chrome's runtime messaging API
beforeAll(() => {
  global.chrome = {
    runtime: {
      sendMessage: jest.fn(),
    },
  };
  window.close = jest.fn();
});

describe("SidePanelButton", () => {
  beforeEach(() => {
    jest.clearAllMocks(); // Clear mocks between tests
  });

  test("renders initial state correctly", () => {
    render(<SidePanelButton />);

    expect(
      screen.getByText(/Open Sidebar/i)
    ).toBeInTheDocument();
  });

  test("open side panel", () => {
    const { getByText } = render(<SidePanelButton />);
    const button = getByText(/Open Sidebar/i);

    fireEvent.click(button);

    expect(chrome.runtime.sendMessage).toHaveBeenCalledWith({
      type: "OPEN_SIDEPANEL",
    });
  });

  test("check window closed", async () => {
    const { getByText } = render(<SidePanelButton />);
    const button = getByText(/Open Sidebar/i);

    fireEvent.click(button);

    expect(window.close).toHaveBeenCalled();
  });
});
