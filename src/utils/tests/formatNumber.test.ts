import { formatNumber } from '../helpers';

describe('formatNumber', () => {
  describe('numbers below 1 000 (no suffix)', () => {
    it('returns "0" for zero', () => {
      expect(formatNumber(0)).toBe('0');
    });

    it('returns the number as a string for 1', () => {
      expect(formatNumber(1)).toBe('1');
    });

    it('returns the number as a string for 999', () => {
      expect(formatNumber(999)).toBe('999');
    });
  });

  describe('K suffix (≥ 1 000, < 1 000 000)', () => {
    it('formats 1 000 as "1.0K"', () => {
      expect(formatNumber(1000)).toBe('1.0K');
    });

    it('formats 1 500 as "1.5K"', () => {
      expect(formatNumber(1500)).toBe('1.5K');
    });

    it('formats 15 500 as "15.5K"', () => {
      expect(formatNumber(15500)).toBe('15.5K');
    });

    it('formats 999 999 as "1000.0K" (below the M threshold)', () => {
      expect(formatNumber(999_999)).toBe('1000.0K');
    });
  });

  describe('M suffix (≥ 1 000 000)', () => {
    it('formats 1 000 000 as "1.0M"', () => {
      expect(formatNumber(1_000_000)).toBe('1.0M');
    });

    it('formats 2 450 000 as "2.5M" (rounds to one decimal)', () => {
      expect(formatNumber(2_450_000)).toBe('2.5M');
    });

    it('formats 10 000 000 as "10.0M"', () => {
      expect(formatNumber(10_000_000)).toBe('10.0M');
    });
  });

  describe('boundary values', () => {
    it('handles the exact boundary between plain and K (999 vs 1 000)', () => {
      expect(formatNumber(999)).toBe('999');
      expect(formatNumber(1000)).toBe('1.0K');
    });

    it('handles the exact boundary between K and M (999 999 vs 1 000 000)', () => {
      expect(formatNumber(999_999)).toBe('1000.0K');
      expect(formatNumber(1_000_000)).toBe('1.0M');
    });
  });
});
