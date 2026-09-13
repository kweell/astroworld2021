import type { TimeWindow } from "../types/common.js";
import { intersect, parseWindow, durationMinutesOf, toTimeWindow } from "./windows.js";

/**
 * Returns every overlap between two sets of windows that is at least `requiredMinutes` long.
 * Results are sorted chronologically for deterministic output.
 */
export function findOverlap(a: TimeWindow[], b: TimeWindow[], requiredMinutes: number): TimeWindow[] {
  const parsedA = a.map(parseWindow);
  const parsedB = b.map(parseWindow);

  const overlaps = [];
  for (const windowA of parsedA) {
    for (const windowB of parsedB) {
      const overlap = intersect(windowA, windowB);
      if (overlap && durationMinutesOf(overlap) >= requiredMinutes) {
        overlaps.push(overlap);
      }
    }
  }

  return overlaps
    .sort((x, y) => x.startMs - y.startMs)
    .map((o) => toTimeWindow(o.startMs, o.endMs));
}
