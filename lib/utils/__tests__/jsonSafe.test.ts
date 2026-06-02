import { toJsonSafe } from '../jsonSafe';

describe('toJsonSafe', () => {
  it('serializes bigint values to string', () => {
    expect(toJsonSafe(123n)).toBe('123');
    expect(toJsonSafe({ value: 456n })).toEqual({ value: '456' });
  });

  it('preserves null and undefined values', () => {
    expect(toJsonSafe(null)).toBeNull();
    expect(toJsonSafe(undefined)).toBeUndefined();
  });

  it('preserves Date objects as-is', () => {
    const now = new Date();
    expect(toJsonSafe(now)).toBe(now);
  });

  it('recursively transforms arrays', () => {
    const input = [123n, { val: 456n }, null];
    const expected = ['123', { val: '456' }, null];
    expect(toJsonSafe(input)).toEqual(expected);
  });

  it('recursively transforms objects', () => {
    const input = {
      id: 123n,
      meta: {
        count: 456n,
        tags: [789n]
      }
    };
    const expected = {
      id: '123',
      meta: {
        count: '456',
        tags: ['789']
      }
    };
    expect(toJsonSafe(input)).toEqual(expected);
  });

  it('returns primitive values as-is', () => {
    expect(toJsonSafe(42)).toBe(42);
    expect(toJsonSafe('hello')).toBe('hello');
    expect(toJsonSafe(true)).toBe(true);
  });
});
