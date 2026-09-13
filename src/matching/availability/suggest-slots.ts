import type { TimeWindow } from '../types/common.js';
import {
  intersect,
  parseWindow,
  subtractIntervals,
  durationMinutesOf,
  toTimeWindow,
} from './windows.js';

/**
 * Suggests concrete, non-conflicting bookable slots of exactly `requiredMinutes`,
 * drawn from where participant and volunteer availability overlap, with existing
 * bookings removed. Deterministic and timezone-safe (all comparisons are on
 * absolute instants; inputs/outputs are ISO-8601).
 */
export function suggestSlots(
  participantWindows: TimeWindow[],
  volunteerWindows: TimeWindow[],
  existingBookings: TimeWindow[],
  requiredMinutes: number,
): TimeWindow[] {
  const parsedParticipant = participantWindows.map(parseWindow);
  const parsedVolunteer = volunteerWindows.map(parseWindow);
  const parsedBusy = existingBookings.map(parseWindow);

  const slots = [];

  for (const p of parsedParticipant) {
    for (const v of parsedVolunteer) {
      const overlap = intersect(p, v);
      if (!overlap) continue;

      const freeSegments = subtractIntervals(overlap, parsedBusy);
      for (const segment of freeSegments) {
        if (durationMinutesOf(segment) >= requiredMinutes) {
          slots.push({
            startMs: segment.startMs,
            endMs: segment.startMs + requiredMinutes * 60_000,
          });
        }
      }
    }
  }

  const seen = new Set<string>();
  const deduped = slots
    .sort((a, b) => a.startMs - b.startMs)
    .filter((slot) => {
      const key = `${slot.startMs}-${slot.endMs}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });

  return deduped.map((slot) => toTimeWindow(slot.startMs, slot.endMs));
}
