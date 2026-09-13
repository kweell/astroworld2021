import type { Engagement, VolunteerProfile } from '../domain/entities.js';
import { fail } from '../domain/errors.js';
import type { ResolvedMode, ServiceType, TimeWindow } from '../domain/types.js';
import type { Repository } from '../repositories/interfaces.js';
export function assertVolunteer(
  profile: VolunteerProfile,
  service: ServiceType,
  mode?: ResolvedMode,
): void {
  if (profile.verification_status !== 'verified')
    fail('VOLUNTEER_UNVERIFIED', 'Volunteer must be verified');
  if (!profile.supported_services.includes(service))
    fail('UNSUPPORTED_SERVICE', 'Volunteer does not support this service');
  if (mode && !profile.supported_modes.includes(mode))
    fail('UNSUPPORTED_MODE', 'Volunteer does not support this mode');
}
export function contains(
  windows: TimeWindow[],
  start: string,
  end: string,
): boolean {
  return windows.some(
    (w) =>
      Date.parse(w.start) <= Date.parse(start) &&
      Date.parse(w.end) >= Date.parse(end),
  );
}
export const overlaps = (a: TimeWindow, b: TimeWindow) =>
  Date.parse(a.start) < Date.parse(b.end) &&
  Date.parse(b.start) < Date.parse(a.end);
// Singapore is UTC+08 year-round. Weeks begin Monday 00:00 in Singapore.
export function weekStart(instant: string): number {
  const date = new Date(Date.parse(instant) + 8 * 3600000);
  return (
    Date.UTC(
      date.getUTCFullYear(),
      date.getUTCMonth(),
      date.getUTCDate() - ((date.getUTCDay() + 6) % 7),
    ) -
    8 * 3600000
  );
}
export async function usedWeeklyMinutes(
  repo: Repository,
  volunteerId: string,
  instant: string,
  excludeOfferId?: string,
): Promise<number> {
  const week = weekStart(instant);
  const inWeek = (date: string) => weekStart(date) === week;
  const offers = (
    await repo.list('volunteer_offers', { volunteer_id: volunteerId })
  ).filter(
    (o) =>
      o.id !== excludeOfferId &&
      ['open', 'full', 'completed'].includes(o.status) &&
      inWeek(o.starts_at),
  );
  const engagements = (
    await repo.list('engagements', { volunteer_id: volunteerId })
  ).filter(
    (e) =>
      e.request_id &&
      e.status !== 'cancelled' &&
      inWeek(e.scheduled_start ?? e.created_at),
  );
  return (
    offers.length * 15 +
    engagements.reduce((sum, e) => sum + e.duration_minutes, 0)
  );
}
export async function assertWeeklyCapacity(
  repo: Repository,
  profile: VolunteerProfile,
  instant: string,
  minutes: number,
  excludeOfferId?: string,
): Promise<void> {
  if (
    (await usedWeeklyMinutes(repo, profile.user_id, instant, excludeOfferId)) +
      minutes >
    profile.max_weekly_minutes
  )
    fail(
      'WEEKLY_CAPACITY_EXCEEDED',
      'Volunteer has insufficient weekly minutes',
    );
}
export async function busyWindows(
  repo: Repository,
  userId: string,
  excludeOfferId?: string,
): Promise<TimeWindow[]> {
  const engagements = (await repo.list('engagements')).filter(
    (e) =>
      (e.participant_id === userId || e.volunteer_id === userId) &&
      e.status !== 'cancelled' &&
      (!excludeOfferId || e.offer_id !== excludeOfferId) &&
      e.scheduled_start &&
      e.scheduled_end,
  );
  const offers = (
    await repo.list('volunteer_offers', { volunteer_id: userId })
  ).filter(
    (o) =>
      o.id !== excludeOfferId &&
      ['open', 'full', 'completed'].includes(o.status),
  );
  return [
    ...engagements.map((e) => ({
      start: e.scheduled_start!,
      end: e.scheduled_end!,
    })),
    ...offers.map((o) => ({ start: o.starts_at, end: o.ends_at })),
  ];
}
export async function assertNoConflict(
  repo: Repository,
  userId: string,
  window: TimeWindow,
  excludeOfferId?: string,
): Promise<void> {
  if (
    (await busyWindows(repo, userId, excludeOfferId)).some((b) =>
      overlaps(b, window),
    )
  )
    fail(
      'BOOKING_CONFLICT',
      'This time conflicts with an existing booking or offer',
    );
}
// Subtract reserved times from the stored availability; ranking belongs to Member 2.
export function unreservedWindows(
  windows: TimeWindow[],
  busy: TimeWindow[],
): TimeWindow[] {
  return windows.flatMap((window) => {
    let parts = [window];
    for (const booking of busy)
      parts = parts.flatMap((part) => {
        if (!overlaps(part, booking)) return [part];
        const remaining: TimeWindow[] = [];
        if (Date.parse(part.start) < Date.parse(booking.start))
          remaining.push({ start: part.start, end: booking.start });
        if (Date.parse(part.end) > Date.parse(booking.end))
          remaining.push({ start: booking.end, end: part.end });
        return remaining;
      });
    return parts;
  });
}
export const isEngagementMember = (id: string, e: Engagement) =>
  e.participant_id === id || e.volunteer_id === id;
