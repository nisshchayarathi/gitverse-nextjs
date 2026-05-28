const DEFAULT_SETTINGS = {
  provider: 'gemini' as const,
  geminiKey: '',
  openaiKey: '',
};

function parseAISettings(stored: string | null): typeof DEFAULT_SETTINGS {
  if (!stored) return DEFAULT_SETTINGS;
  try {
    return { ...DEFAULT_SETTINGS, ...JSON.parse(stored) };
  } catch {
    return DEFAULT_SETTINGS;
  }
}

describe('useAISettings', () => {
  describe('parseAISettings', () => {
    it('returns default settings when null', () => {
      const result = parseAISettings(null);
      expect(result.provider).toBe('gemini');
      expect(result.geminiKey).toBe('');
      expect(result.openaiKey).toBe('');
    });

    it('returns default settings when empty string', () => {
      const result = parseAISettings('');
      expect(result.provider).toBe('gemini');
    });

    it('loads valid stored settings', () => {
      const result = parseAISettings(JSON.stringify({
        provider: 'openai',
        geminiKey: 'test-key',
        openaiKey: 'openai-key',
      }));
      expect(result.provider).toBe('openai');
      expect(result.geminiKey).toBe('test-key');
      expect(result.openaiKey).toBe('openai-key');
    });

    it('handles corrupted JSON', () => {
      const result = parseAISettings('not valid json');
      expect(result.provider).toBe('gemini');
      expect(result.geminiKey).toBe('');
    });

    it('partial settings preserve defaults', () => {
      const result = parseAISettings(JSON.stringify({ provider: 'openai' }));
      expect(result.provider).toBe('openai');
      expect(result.geminiKey).toBe('');
    });
  });

  describe('default settings', () => {
    it('has gemini as default provider', () => {
      expect(DEFAULT_SETTINGS.provider).toBe('gemini');
    });

    it('has empty API keys', () => {
      expect(DEFAULT_SETTINGS.geminiKey).toBe('');
      expect(DEFAULT_SETTINGS.openaiKey).toBe('');
    });
  });

  describe('provider types', () => {
    it('supports gemini provider', () => {
      const settings = { ...DEFAULT_SETTINGS, provider: 'gemini' as const };
      expect(settings.provider).toBe('gemini');
    });

    it('supports openai provider', () => {
      const settings = { ...DEFAULT_SETTINGS, provider: 'openai' as const };
      expect(settings.provider).toBe('openai');
    });
  });
});