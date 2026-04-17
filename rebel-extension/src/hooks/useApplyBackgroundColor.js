import { useEffect, useState } from "react";

const DEFAULT_COLOR = "#BB0000";
const DEFAULT_TEXT = "#d3d3d3";

export const THEMES = {
  obsidian: {
    background: "#121212",   
    text: "#e0e0e0",          
  },  
  sunset: {
    background: "#ff7e5f",
    text: "#2d2d2d",
  },
  ocean: {
    background: "#2E8BC0",
    text: "#ffffff",
  },
  lavenderDream: {
    background: "#b57edc",
    text: "#ffffff",
  },
  forest: {
    background: "#228B22",
    text: "#e6ffe6",
  },
  cottonCandy: {
    background: "#ffb6c1",
    text: "#5b5b5b",
  },  
  nightSky: {
    background: "#0b1d3a",  
    text: "#dbeafe",         
  },
  sebastianPick: {
    background: "#1a21ff",
    text: "#ffffff",
  }
};


const useApplyBackgroundColor = () => {
  const [selectedColor, setSelectedColor] = useState(DEFAULT_COLOR);
  const [textColor, setTextColor] = useState(DEFAULT_TEXT);
  const [themeKey, setThemeKey] = useState("custom");

  const blendHexColor = (color, ratio = 0.5) => {
    if (!color || !color.startsWith("#") || color.length !== 7) {
      return color;
    }

    const clampRatio = Math.max(0, Math.min(1, ratio));
    const red = Number.parseInt(color.slice(1, 3), 16);
    const green = Number.parseInt(color.slice(3, 5), 16);
    const blue = Number.parseInt(color.slice(5, 7), 16);
    const mixChannel = (channel) => Math.round(channel + ((255 - channel) * clampRatio));

    return `#${[mixChannel(red), mixChannel(green), mixChannel(blue)]
      .map((channel) => channel.toString(16).padStart(2, "0"))
      .join("")}`;
  };

  const applyColor = (bg, text) => {
    const gradient = `linear-gradient(135deg, ${bg}, ${blendHexColor(bg, 0.5)})`;
    document.documentElement.style.setProperty("--app-background", gradient);
    document.documentElement.style.setProperty("--app-text-color", text);
    document.body.style.background = gradient;
    document.body.style.color = text;
  };

  useEffect(() => {
    chrome.storage.sync.get(
      ["backgroundColor", "textColor", "selectedThemeKey"],
      (data) => {
        const baseColor = data.backgroundColor || DEFAULT_COLOR;
        const txtColor = data.textColor || DEFAULT_TEXT;
        const theme = data.selectedThemeKey || "custom";
        setSelectedColor(baseColor);
        setTextColor(txtColor);
        setThemeKey(theme);
        applyColor(baseColor, txtColor);
      }
    );
  }, []);

  const handleColorChange = (event) => {
    const newColor = event.target.value;
    setSelectedColor(newColor);
    setTextColor(DEFAULT_TEXT);
    setThemeKey("custom");

    chrome.storage.sync.set({
      backgroundColor: newColor,
      textColor: DEFAULT_TEXT,
      selectedThemeKey: "custom",
    });

    applyColor(newColor, DEFAULT_TEXT);
    chrome.runtime.sendMessage({
      type: "COLOR_UPDATED",
      color: newColor,
      textColor: DEFAULT_TEXT,
    });
  };

  const handleResetColor = () => {
    setSelectedColor(DEFAULT_COLOR);
    setTextColor(DEFAULT_TEXT);
    setThemeKey("custom");

    chrome.storage.sync.set({
      backgroundColor: DEFAULT_COLOR,
      textColor: DEFAULT_TEXT,
      selectedThemeKey: "custom",
    });

    applyColor(DEFAULT_COLOR, DEFAULT_TEXT);
    chrome.runtime.sendMessage({
      type: "COLOR_UPDATED",
      color: DEFAULT_COLOR,
      textColor: DEFAULT_TEXT,
    });
  };

  const handleThemeSelection = (newKey) => {
    setThemeKey(newKey);
    const theme = THEMES[newKey];
    if (theme) {
      setSelectedColor(theme.background);
      setTextColor(theme.text);
      chrome.storage.sync.set({
        backgroundColor: theme.background,
        textColor: theme.text,
        selectedThemeKey: newKey,
      });
      applyColor(theme.background, theme.text);
      chrome.runtime.sendMessage({
        type: "COLOR_UPDATED",
        color: theme.background,
        textColor: theme.text,
      });
    }
  };

  return {
    selectedColor,
    textColor,
    themeKey,
    handleColorChange,
    handleResetColor,
    handleThemeSelection,
  };
};

export default useApplyBackgroundColor;
