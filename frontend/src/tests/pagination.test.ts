import { describe, expect, it } from 'vitest';
import { getPaginationItems } from '../utils/pagination';

describe('getPaginationItems', () => {
  it('returns all pages when totalPages <= 7', () => {
    expect(getPaginationItems(1, 5)).toEqual([1, 2, 3, 4, 5]);
    expect(getPaginationItems(3, 7)).toEqual([1, 2, 3, 4, 5, 6, 7]);
  });

  it('formats page 1 as [1, 2, 3, "...", 27] for 27 pages', () => {
    expect(getPaginationItems(1, 27)).toEqual([1, 2, 3, '...', 27]);
  });

  it('formats early pages near the start correctly', () => {
    expect(getPaginationItems(2, 27)).toEqual([1, 2, 3, '...', 27]);
    expect(getPaginationItems(3, 27)).toEqual([1, 2, 3, 4, '...', 27]);
    expect(getPaginationItems(4, 27)).toEqual([1, 2, 3, 4, 5, '...', 27]);
  });

  it('formats middle pages with ellipsis on both sides', () => {
    expect(getPaginationItems(5, 27)).toEqual([1, '...', 4, 5, 6, '...', 27]);
    expect(getPaginationItems(14, 27)).toEqual([1, '...', 13, 14, 15, '...', 27]);
    expect(getPaginationItems(23, 27)).toEqual([1, '...', 22, 23, 24, '...', 27]);
  });

  it('formats late pages near the end correctly', () => {
    expect(getPaginationItems(24, 27)).toEqual([1, '...', 23, 24, 25, 26, 27]);
    expect(getPaginationItems(25, 27)).toEqual([1, '...', 24, 25, 26, 27]);
    expect(getPaginationItems(26, 27)).toEqual([1, '...', 25, 26, 27]);
    expect(getPaginationItems(27, 27)).toEqual([1, '...', 25, 26, 27]);
  });

  it('handles boundary edge inputs safely', () => {
    expect(getPaginationItems(0, 27)).toEqual([1, 2, 3, '...', 27]);
    expect(getPaginationItems(999, 27)).toEqual([1, '...', 25, 26, 27]);
    expect(getPaginationItems(1, 0)).toEqual([]);
    expect(getPaginationItems(1, 1)).toEqual([1]);
  });
});
