import {
  extractRepoInfo,
  formatNumber,
  formatDate,
  validateRepoUrl,
} from '../helpers';

describe('src/utils/helpers', () => {
  describe('validateRepoUrl', () => {
    it('accepts GitHub/GitLab/Bitbucket URLs', () => {
      expect(
        validateRepoUrl('https://github.com/octocat/Hello-World')
      ).toBe(true);
      expect(
        validateRepoUrl('https://gitlab.com/group/project')
      ).toBe(true);
      expect(
        validateRepoUrl('https://bitbucket.org/team/repo')
      ).toBe(true);
    });

    it('rejects unsupported hosts', () => {
      expect(
        validateRepoUrl('https://example.com/octocat/Hello-World')
      ).toBe(false);
    });
  });

  describe('extractRepoInfo', () => {
    it('parses owner and repo from supported URLs', () => {
      expect(
        extractRepoInfo('https://github.com/octocat/Hello-World')
      ).toEqual({
        platform: 'github',
        owner: 'octocat',
        repo: 'Hello-World',
      });

      expect(
        extractRepoInfo('https://gitlab.com/group/my.repo')
      ).toEqual({
        platform: 'gitlab',
        owner: 'group',
        repo: 'my.repo',
      });

      expect(
        extractRepoInfo('https://bitbucket.org/team/repo-name')
      ).toEqual({
        platform: 'bitbucket',
        owner: 'team',
        repo: 'repo-name',
      });
    });

    it('returns null for unsupported URLs', () => {
      expect(extractRepoInfo('https://example.com/a/b')).toBeNull();
    });
  });

  describe('formatNumber', () => {
    it('formats values using K and M suffixes', () => {
      expect(formatNumber(999)).toBe('999');
      expect(formatNumber(1000)).toBe('1.0K');
      expect(formatNumber(15500)).toBe('15.5K');
      expect(formatNumber(1_000_000)).toBe('1.0M');
      expect(formatNumber(2_450_000)).toBe('2.5M');
    });

    it('handles boundary values', () => {
      expect(formatNumber(0)).toBe('0');
      expect(formatNumber(999)).toBe('999');
      expect(formatNumber(1000)).toBe('1.0K');
      expect(formatNumber(999_999)).toBe('1000.0K');
    });
  });

  describe('formatDate', () => {
    it('formats dates in US short format', () => {
      const date = new Date('2024-03-15');
      const formatted = formatDate(date);
      expect(formatted).toMatch(/Mar/);
      expect(formatted).toMatch(/15/);
      expect(formatted).toMatch(/2024/);
    });

    it('formats different months correctly', () => {
      const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      months.forEach((month, index) => {
        const date = new Date(2024, index, 1);
        expect(formatDate(date)).toContain(month);
      });
    });

    it('handles different years', () => {
      const date2020 = new Date('2020-01-01');
      const date2030 = new Date('2030-12-31');
      expect(formatDate(date2020)).toMatch(/2020/);
      expect(formatDate(date2030)).toMatch(/2030/);
    });
  });
});

