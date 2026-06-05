import { useState, useEffect } from "react";

export type AIProviderType = "gemini" | "openai";

export interface AISettings {
  provider: AIProviderType;
  geminiKey: string;
  openaiKey: string;
}

const DEFAULT_SETTINGS: AISettings = {
  provider: "gemini",
  geminiKey: "",
  openaiKey: "",
};

export function useAISettings() {
  const [settings, setSettings] = useState<AISettings>(DEFAULT_SETTINGS);
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    try {
      const stored = localStorage.getItem("gitverse_ai_settings");
      if (stored) {
        setSettings(JSON.parse(stored));
      }
    } catch (e) {
      console.error("Failed to parse AI settings", e);
    }
    setIsLoaded(true);
  }, []);

  const updateSettings = (newSettings: Partial<AISettings>) => {
    const updated = { ...settings, ...newSettings };
    setSettings(updated);
    localStorage.setItem("gitverse_ai_settings", JSON.stringify(updated));
  };

  return { settings, updateSettings, isLoaded };
}
