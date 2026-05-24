import React, { useState, useEffect } from "react";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { useAISettings, AIProviderType } from "@/hooks/useAISettings";

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

export const AISettingsModal: React.FC<Props> = ({ isOpen, onClose }) => {
  const { settings, updateSettings, isLoaded } = useAISettings();
  const [provider, setProvider] = useState<AIProviderType>(settings.provider);
  const [geminiKey, setGeminiKey] = useState(settings.geminiKey);
  const [openaiKey, setOpenaiKey] = useState(settings.openaiKey);

  useEffect(() => {
    if (isOpen && isLoaded) {
      setProvider(settings.provider);
      setGeminiKey(settings.geminiKey);
      setOpenaiKey(settings.openaiKey);
    }
  }, [isOpen, settings, isLoaded]);

  const handleSave = () => {
    updateSettings({ provider, geminiKey, openaiKey });
    onClose();
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="AI Summary Settings" size="md">
      <div className="space-y-4">
        <p className="text-sm text-muted-foreground">
          Configure your LLM provider to generate module summaries. Keys are stored securely in your browser's local storage and are never sent to our servers.
        </p>
        
        <div>
          <label className="block text-sm font-medium mb-1">Provider</label>
          <select 
            value={provider}
            onChange={(e) => setProvider(e.target.value as AIProviderType)}
            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-base md:text-sm"
          >
            <option value="gemini">Google Gemini</option>
            <option value="openai">OpenAI</option>
          </select>
        </div>

        {provider === "gemini" && (
          <div>
            <label className="block text-sm font-medium mb-1">Gemini API Key</label>
            <Input 
              type="password"
              placeholder="AIzaSy..."
              value={geminiKey}
              onChange={(e) => setGeminiKey(e.target.value)}
            />
          </div>
        )}

        {provider === "openai" && (
          <div>
            <label className="block text-sm font-medium mb-1">OpenAI API Key</label>
            <Input 
              type="password"
              placeholder="sk-..."
              value={openaiKey}
              onChange={(e) => setOpenaiKey(e.target.value)}
            />
          </div>
        )}

        <div className="flex justify-end gap-2 pt-4">
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={handleSave}>Save Settings</Button>
        </div>
      </div>
    </Modal>
  );
};
