const VALID_VIEW_MODES = ["grid", "list"];
const VALID_SORT_OPTIONS = ["recent", "stars", "name"];

const DEFAULTS = {
  viewMode: "grid",
  sortBy: "recent",
};

function loadPrefs(stored: string | null) {
  if (!stored) return DEFAULTS;

  try {
    const parsed = JSON.parse(stored);

    const viewMode = VALID_VIEW_MODES.includes(parsed.viewMode)
      ? parsed.viewMode
      : DEFAULTS.viewMode;

    const sortBy = VALID_SORT_OPTIONS.includes(parsed.sortBy)
      ? parsed.sortBy
      : DEFAULTS.sortBy;

    return { viewMode, sortBy };
  } catch {
    return DEFAULTS;
  }
}

describe('loadPrefs', () => {
  it('returns defaults when localStorage is empty', () => {
    const result = loadPrefs(null);
    expect(result).toEqual({ viewMode: 'grid', sortBy: 'recent' });
  });

  it('loads valid preferences from localStorage', () => {
    const result = loadPrefs(JSON.stringify({
      viewMode: 'list',
      sortBy: 'stars',
    }));
    expect(result).toEqual({ viewMode: 'list', sortBy: 'stars' });
  });

  it('falls back to defaults for invalid viewMode', () => {
    const result = loadPrefs(JSON.stringify({
      viewMode: 'invalid',
      sortBy: 'stars',
    }));
    expect(result.viewMode).toBe('grid');
    expect(result.sortBy).toBe('stars');
  });

  it('falls back to defaults for invalid sortBy', () => {
    const result = loadPrefs(JSON.stringify({
      viewMode: 'list',
      sortBy: 'invalid',
    }));
    expect(result.viewMode).toBe('list');
    expect(result.sortBy).toBe('recent');
  });

  it('falls back to defaults for invalid JSON', () => {
    const result = loadPrefs('not valid json');
    expect(result).toEqual({ viewMode: 'grid', sortBy: 'recent' });
  });

  it('handles partial valid data', () => {
    const result = loadPrefs(JSON.stringify({ viewMode: 'list' }));
    expect(result.viewMode).toBe('list');
    expect(result.sortBy).toBe('recent');
  });
});

describe('preference validation', () => {
  it('recognizes valid viewModes', () => {
    expect(VALID_VIEW_MODES).toContain('grid');
    expect(VALID_VIEW_MODES).toContain('list');
    expect(VALID_VIEW_MODES).not.toContain('invalid');
  });

  it('recognizes valid sortOptions', () => {
    expect(VALID_SORT_OPTIONS).toContain('recent');
    expect(VALID_SORT_OPTIONS).toContain('stars');
    expect(VALID_SORT_OPTIONS).toContain('name');
    expect(VALID_SORT_OPTIONS).not.toContain('invalid');
  });

  it('defaults are valid', () => {
    expect(VALID_VIEW_MODES).toContain(DEFAULTS.viewMode);
    expect(VALID_SORT_OPTIONS).toContain(DEFAULTS.sortBy);
  });
});