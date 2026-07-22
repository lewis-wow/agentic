import { describe, expect, it } from 'vitest';

import { addChips } from '../../src/components/ui/tag-input';

describe('addChips', () => {
  it('adds a single value with no comma', () => {
    expect(addChips([], 'pro')).toEqual(['pro']);
  });

  it('splits a comma-separated paste into multiple chips', () => {
    expect(addChips([], 'a, b, c')).toEqual(['a', 'b', 'c']);
  });

  it('trims whitespace around each value', () => {
    expect(addChips([], '  a  ,  b  ')).toEqual(['a', 'b']);
  });

  it('filters out empty entries from stray commas', () => {
    expect(addChips([], 'a,,b, ,c')).toEqual(['a', 'b', 'c']);
  });

  it('silently ignores a value already present in current', () => {
    expect(addChips(['a'], 'a')).toEqual(['a']);
  });

  it('silently dedupes duplicate values within the same batch', () => {
    expect(addChips([], 'a, a, b')).toEqual(['a', 'b']);
  });

  it('appends new values after the existing ones, preserving order', () => {
    expect(addChips(['x', 'y'], 'z, x')).toEqual(['x', 'y', 'z']);
  });

  it('returns an empty array when raw is empty or only whitespace', () => {
    expect(addChips([], '   ')).toEqual([]);
  });
});
