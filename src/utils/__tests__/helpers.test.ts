import {
  extractRepoInfo,
  formatNumber,
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
  });
});

