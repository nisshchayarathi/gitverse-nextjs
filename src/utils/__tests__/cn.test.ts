import { cn } from '@/lib/utils'

describe('cn utility', () => {
  // Basic merging
  it('returns empty string when called with no arguments', () => {
    expect(cn()).toBe('')
  })

  it('returns a single class name unchanged', () => {
    expect(cn('foo')).toBe('foo')
  })

  it('merges multiple class names with a space', () => {
    expect(cn('foo', 'bar', 'baz')).toBe('foo bar baz')
  })

  // Conditional / falsy values
  it('ignores false values', () => {
    expect(cn('foo', false, 'bar')).toBe('foo bar')
  })

  it('ignores null values', () => {
    expect(cn('foo', null, 'bar')).toBe('foo bar')
  })

  it('ignores undefined values', () => {
    expect(cn('foo', undefined, 'bar')).toBe('foo bar')
  })

  it('ignores 0 as a falsy value', () => {
    expect(cn('foo', 0 as any, 'bar')).toBe('foo bar')
  })

  // Conditional class objects (clsx feature)
  it('includes class when object value is true', () => {
    expect(cn({ 'bg-red-500': true })).toBe('bg-red-500')
  })

  it('excludes class when object value is false', () => {
    expect(cn({ 'bg-red-500': false })).toBe('')
  })

  it('handles mixed object and string inputs', () => {
    expect(cn('flex', { 'bg-red-500': true, 'text-white': false })).toBe(
      'flex bg-red-500'
    )
  })

  // Array inputs (clsx feature)
  it('handles array of class names', () => {
    expect(cn(['foo', 'bar'])).toBe('foo bar')
  })

  it('handles nested arrays', () => {
    expect(cn(['foo', ['bar', 'baz']])).toBe('foo bar baz')
  })

  // Tailwind conflict resolution (twMerge feature)
  it('resolves conflicting Tailwind padding classes, keeping the last one', () => {
    expect(cn('p-2', 'p-4')).toBe('p-4')
  })

  it('resolves conflicting Tailwind text color classes', () => {
    expect(cn('text-red-500', 'text-blue-500')).toBe('text-blue-500')
  })

  it('resolves conflicting Tailwind background classes', () => {
    expect(cn('bg-red-500', 'bg-green-500')).toBe('bg-green-500')
  })

  it('keeps non-conflicting Tailwind classes', () => {
    expect(cn('p-4', 'mx-2', 'text-center')).toBe('p-4 mx-2 text-center')
  })

  // Combined real-world usage
  it('handles conditional Tailwind classes correctly', () => {
    const isActive = true
    expect(cn('btn', isActive && 'btn-active')).toBe('btn btn-active')
  })

  it('resolves conflicts when combined with conditionals', () => {
    expect(cn('p-2', true && 'p-6')).toBe('p-6')
  })
}) 