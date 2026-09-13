import type { TimeWindow } from '../types/common.js';
import {
  parseWindow,
  subtractIntervals,
  durationMinutesOf,
} from './windows.js';

/**
 * True if `window` still has a contiguous free stretch of at least `requiredMinutes`
 * once existing bookings that overlap it are removed. Prevents double-booking.
 */
export function isBookable(
  window: TimeWindow,
  existingBookings: TimeWindow[],
  requiredMinutes: number,
): boolean {
  const base = parseWindow(window);
  const busy = existingBookings.map(parseWindow);
  const free = subtractIntervals(base, busy);

  return free.some(
    (interval) => durationMinutesOf(interval) >= requiredMinutes,
  );
}
