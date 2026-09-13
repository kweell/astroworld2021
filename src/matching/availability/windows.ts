import type { TimeWindow } from '../types/common.js';

export interface ParsedWindow {
  startMs: number;
  endMs: number;
}

/** Parses and validates a TimeWindow, throwing if end <= start or the strings are not valid ISO-8601. */
export function parseWindow(window: TimeWindow): ParsedWindow {
  const startMs = Date.parse(window.start);
  const endMs = Date.parse(window.end);

  if (Number.isNaN(startMs) || Number.isNaN(endMs)) {
    throw new Error(
      `Invalid TimeWindow: start=${window.start} end=${window.end}`,
    );
  }
  if (endMs <= startMs) {
    throw new Error(
      `Invalid TimeWindow: end (${window.end}) must be after start (${window.start})`,
    );
  }

  return { startMs, endMs };
}

export function windowDurationMinutes(window: TimeWindow): number {
  const { startMs, endMs } = parseWindow(window);
  return (endMs - startMs) / 60_000;
}

export function toTimeWindow(startMs: number, endMs: number): TimeWindow {
  return {
    start: new Date(startMs).toISOString(),
    end: new Date(endMs).toISOString(),
  };
}

/** Intersection of two parsed intervals, or null if they don't overlap. */
export function intersect(
  a: ParsedWindow,
  b: ParsedWindow,
): ParsedWindow | null {
  const startMs = Math.max(a.startMs, b.startMs);
  const endMs = Math.min(a.endMs, b.endMs);
  return endMs > startMs ? { startMs, endMs } : null;
}

/** Sorts and merges overlapping/adjacent intervals into a minimal set of disjoint intervals. */
export function mergeIntervals(intervals: ParsedWindow[]): ParsedWindow[] {
  if (intervals.length === 0) return [];

  const sorted = [...intervals].sort((a, b) => a.startMs - b.startMs);
  const merged: ParsedWindow[] = [{ ...sorted[0]! }];

  for (const current of sorted.slice(1)) {
    const last = merged[merged.length - 1]!;
    if (current.startMs <= last.endMs) {
      last.endMs = Math.max(last.endMs, current.endMs);
    } else {
      merged.push({ ...current });
    }
  }

  return merged;
}

/** Subtracts a set of busy intervals from a single interval, returning the free remainder(s). */
export function subtractIntervals(
  base: ParsedWindow,
  busy: ParsedWindow[],
): ParsedWindow[] {
  const relevantBusy = mergeIntervals(
    busy
      .map((b) => intersect(base, b))
      .filter((b): b is ParsedWindow => b !== null),
  );

  if (relevantBusy.length === 0) return [base];

  const free: ParsedWindow[] = [];
  let cursor = base.startMs;

  for (const busyInterval of relevantBusy) {
    if (busyInterval.startMs > cursor) {
      free.push({ startMs: cursor, endMs: busyInterval.startMs });
    }
    cursor = Math.max(cursor, busyInterval.endMs);
  }

  if (cursor < base.endMs) {
    free.push({ startMs: cursor, endMs: base.endMs });
  }

  return free;
}

export function durationMinutesOf(interval: ParsedWindow): number {
  return (interval.endMs - interval.startMs) / 60_000;
}
