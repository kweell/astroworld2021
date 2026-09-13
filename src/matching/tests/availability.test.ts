import { describe, expect, it } from 'vitest';
import { findOverlap } from '../availability/find-overlap.js';
import { isBookable } from '../availability/is-bookable.js';
import { suggestSlots } from '../availability/suggest-slots.js';

// 2025-03-04 is a Tuesday. SGT is UTC+8, so 09:00-11:00 SGT is 01:00-03:00 UTC.
const TUE_09_11_SGT = {
  start: '2025-03-04T01:00:00Z',
  end: '2025-03-04T03:00:00Z',
};
const TUE_10_12_SGT = {
  start: '2025-03-04T02:00:00Z',
  end: '2025-03-04T04:00:00Z',
};

describe('findOverlap', () => {
  it('returns the overlapping window when both sides have enough overlap', () => {
    const result = findOverlap([TUE_09_11_SGT], [TUE_10_12_SGT], 30);
    expect(result).toEqual([
      { start: '2025-03-04T02:00:00.000Z', end: '2025-03-04T03:00:00.000Z' },
    ]);
  });

  it('rejects overlaps shorter than the required duration', () => {
    const a = { start: '2025-03-04T01:00:00Z', end: '2025-03-04T01:10:00Z' };
    const b = { start: '2025-03-04T01:05:00Z', end: '2025-03-04T01:20:00Z' };
    expect(findOverlap([a], [b], 30)).toEqual([]);
  });

  it('handles multiple windows on each side and returns them sorted chronologically', () => {
    const a = [
      { start: '2025-03-05T04:00:00Z', end: '2025-03-05T05:00:00Z' },
      { start: '2025-03-04T01:00:00Z', end: '2025-03-04T02:00:00Z' },
    ];
    const b = [
      { start: '2025-03-04T01:30:00Z', end: '2025-03-04T02:30:00Z' },
      { start: '2025-03-05T04:30:00Z', end: '2025-03-05T05:30:00Z' },
    ];
    const result = findOverlap(a, b, 15);
    expect(result.map((w) => w.start)).toEqual([
      '2025-03-04T01:30:00.000Z',
      '2025-03-05T04:30:00.000Z',
    ]);
  });

  it('throws on an invalid window where end is not after start', () => {
    expect(() =>
      findOverlap(
        [{ start: '2025-03-04T01:00:00Z', end: '2025-03-04T01:00:00Z' }],
        [TUE_10_12_SGT],
        10,
      ),
    ).toThrow();
  });
});

describe('isBookable', () => {
  it('is true when a window has enough free time after removing existing bookings', () => {
    const existing = [
      { start: '2025-03-04T01:00:00Z', end: '2025-03-04T01:30:00Z' },
    ];
    expect(isBookable(TUE_09_11_SGT, existing, 30)).toBe(true);
  });

  it('prevents double-booking when the window is fully consumed', () => {
    const existing = [
      { start: '2025-03-04T01:00:00Z', end: '2025-03-04T03:00:00Z' },
    ];
    expect(isBookable(TUE_09_11_SGT, existing, 30)).toBe(false);
  });

  it('is false when remaining free time is shorter than required', () => {
    const existing = [
      { start: '2025-03-04T01:00:00Z', end: '2025-03-04T02:50:00Z' },
    ];
    expect(isBookable(TUE_09_11_SGT, existing, 30)).toBe(false);
  });
});

describe('suggestSlots', () => {
  it('suggests a slot inside the participant/volunteer overlap', () => {
    const slots = suggestSlots([TUE_09_11_SGT], [TUE_10_12_SGT], [], 30);
    expect(slots).toEqual([
      { start: '2025-03-04T02:00:00.000Z', end: '2025-03-04T02:30:00.000Z' },
    ]);
  });

  it('does not suggest a slot that collides with an existing booking', () => {
    // Overlap between these two windows is 02:00-04:00Z; a 02:00-02:45 booking
    // should shift the suggestion to start right after it ends.
    const participant = {
      start: '2025-03-04T01:00:00Z',
      end: '2025-03-04T04:00:00Z',
    };
    const volunteer = {
      start: '2025-03-04T02:00:00Z',
      end: '2025-03-04T04:30:00Z',
    };
    const existing = [
      { start: '2025-03-04T02:00:00Z', end: '2025-03-04T02:45:00Z' },
    ];
    const slots = suggestSlots([participant], [volunteer], existing, 30);
    expect(slots).toEqual([
      { start: '2025-03-04T02:45:00.000Z', end: '2025-03-04T03:15:00.000Z' },
    ]);
  });

  it('returns nothing when there is no overlap long enough for the required duration', () => {
    const slots = suggestSlots([TUE_09_11_SGT], [TUE_10_12_SGT], [], 90);
    expect(slots).toEqual([]);
  });
});
