import { describe, expect, it } from 'vitest';
import { cn } from './cn';

describe('cn', () => {
  it('merges plain class name strings', () => {
    expect(cn('a', 'b')).toBe('a b');
  });

  it('drops falsy values', () => {
    expect(cn('a', false && 'b', undefined, null, 'c')).toBe('a c');
  });

  it('resolves conflicting Tailwind utility classes, keeping the last one', () => {
    expect(cn('px-2', 'px-4')).toBe('px-4');
  });
});
