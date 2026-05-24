import { cn } from '../utils';

describe('lib/utils', () => {
  it('merges class names deterministically', () => {
    expect(cn('a', 'b')).toBe('a b');
    expect(cn('p-2', 'p-4')).toBe('p-4');
    expect(cn('text-sm', false && 'hidden', 'text-sm')).toBe('text-sm');
  });
});

