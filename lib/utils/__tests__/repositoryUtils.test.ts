import {
  getLanguageColor,
  formatFileSize,
  formatRelativeTime,
  getShortHash,
  generateAvatar,
  parseCommitMessage,
  isFeatureBranch,
  isBugfixBranch,
  isReleaseBranch,
  normalizeKnownRepoHttpUrl,
  normalizeTargetDirectory
} from '../repositoryUtils';

describe('repositoryUtils', () => {
  describe('getLanguageColor', () => {
    it('returns custom hex for supported language', () => {
      expect(getLanguageColor('TypeScript')).toBe('#3178c6');
      expect(getLanguageColor('JavaScript')).toBe('#f1e05a');
    });

    it('returns default fallback color for unsupported language', () => {
      expect(getLanguageColor('UnknownLang')).toBe('#858585');
    });
  });

  describe('formatFileSize', () => {
    it('formats bytes size correctly', () => {
      expect(formatFileSize(0)).toBe('0 B');
      expect(formatFileSize(-1)).toBe('0 B');
      expect(formatFileSize(0.5)).toBe('0 B');
      expect(formatFileSize(Number.NaN)).toBe('0 B');
      expect(formatFileSize(Number.POSITIVE_INFINITY)).toBe('0 B');
      expect(formatFileSize(500)).toBe('500 B');
      expect(formatFileSize(1024)).toBe('1 KB');
      expect(formatFileSize(1024 * 1024 * 1.5)).toBe('1.5 MB');
    });

    it('formats petabyte and larger values with valid units', () => {
      expect(formatFileSize(1024 ** 5)).toBe('1 PB');
      expect(formatFileSize(1024 ** 6)).toBe('1 EB');
      expect(formatFileSize(1024 ** 7)).toBe('1024 EB');
    });
  });

  describe('formatRelativeTime', () => {
    it('returns formatted relative times correctly', () => {
      const now = new Date();
      expect(formatRelativeTime(new Date(now.getTime() - 10 * 1000))).toBe('Just now');
      expect(formatRelativeTime(new Date(now.getTime() - 5 * 60 * 1000))).toBe('5m ago');
      expect(formatRelativeTime(new Date(now.getTime() - 3 * 3600 * 1000))).toBe('3h ago');
    });
  });

  describe('getShortHash', () => {
    it('slices git hash to custom length', () => {
      const hash = 'a1b2c3d4e5f6a1b2c3d4e5f6';
      expect(getShortHash(hash)).toBe('a1b2c3d');
      expect(getShortHash(hash, 10)).toBe('a1b2c3d4e5');
    });
  });

  describe('generateAvatar', () => {
    it('returns a DiceBear avatar SVG URL based on seed', () => {
      expect(generateAvatar('test@example.com')).toContain('seed=test%40example.com');
    });
  });

  describe('parseCommitMessage', () => {
    it('correctly parses conventional commit format', () => {
      const msg = 'feat(ui)!: add modern landing page';
      const parsed = parseCommitMessage(msg);
      expect(parsed).toEqual({
        type: 'feat',
        scope: 'ui',
        subject: 'add modern landing page',
        breaking: true
      });
    });

    it('handles non-conventional commits gracefully', () => {
      expect(parseCommitMessage('random commit')).toEqual({
        subject: 'random commit',
        breaking: false
      });
    });
  });

  describe('branch name detection', () => {
    it('identifies feature branches correctly', () => {
      expect(isFeatureBranch('feature/ui')).toBe(true);
      expect(isFeatureBranch('feat/login')).toBe(true);
      expect(isFeatureBranch('fix/bug')).toBe(false);
    });

    it('identifies bugfix branches correctly', () => {
      expect(isBugfixBranch('fix/bug')).toBe(true);
      expect(isBugfixBranch('bugfix/crash')).toBe(true);
      expect(isBugfixBranch('release/1.0')).toBe(false);
    });

    it('identifies release branches correctly', () => {
      expect(isReleaseBranch('release/v1')).toBe(true);
      expect(isReleaseBranch('hotfix/issue')).toBe(true);
    });
  });

  describe('normalizeKnownRepoHttpUrl', () => {
    it('standardizes supported provider repository URLs', () => {
      expect(normalizeKnownRepoHttpUrl('https://github.com/user/repo.git')).toBe('https://github.com/user/repo');
      expect(normalizeKnownRepoHttpUrl('https://gitlab.com/group/repo')).toBe('https://gitlab.com/group/repo');
      expect(normalizeKnownRepoHttpUrl('https://unsupported.com/user/repo')).toBe('https://unsupported.com/user/repo');
      expect(normalizeKnownRepoHttpUrl('invalid-url')).toBeNull();
    });
  });

  describe('normalizeTargetDirectory', () => {
    it('normalizes target directory path strings', () => {
      expect(normalizeTargetDirectory(null)).toBeNull();
      expect(normalizeTargetDirectory('')).toBeNull();
      expect(normalizeTargetDirectory('./src/components/')).toBe('src/components');
      expect(normalizeTargetDirectory('src\\utils')).toBe('src/utils');
    });

    it('returns null for directory paths containing path traversal or unsafe characters', () => {
      expect(normalizeTargetDirectory('../traversal')).toBeNull();
      expect(normalizeTargetDirectory('src/invalid$Segment')).toBeNull();
    });
  });
});
