import { describe, it, expect } from 'vitest';
import { cn } from './utils';

describe('utils', () => {
  describe('cn', () => {
    it('merges class names correctly', () => {
      expect(cn('c1', 'c2')).toBe('c1 c2');
    });

    it('merges tailwind classes correctly (resolving conflicts)', () => {
      // p-4 should override p-2 because of tailwind-merge logic
      expect(cn('p-2', 'p-4')).toBe('p-4');
    });

    it('handles conditional classes', () => {
      expect(cn('c1', false && 'c2', 'c3')).toBe('c1 c3');
      expect(cn('c1', true && 'c2', 'c3')).toBe('c1 c2 c3');
    });

    it('handles undefined and null inputs', () => {
        expect(cn('c1', undefined, null, 'c2')).toBe('c1 c2');
    });
  });
});
