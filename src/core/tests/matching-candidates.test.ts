import { describe, expect, it } from 'vitest';
import { useTestDatabase, demoIds, resultFor } from './fixtures.js';
import { weekStart } from '../services/booking-rules.js';
describe('matching integration projection', () => {
  const t = useTestDatabase();
  it('returns only the exact candidate contract, without contacts or identity profile fields', async () => {
    await t.db.transaction((repo) =>
      repo.update('users', t.volunteer.id, {
        email: 'never-share@example.invalid',
      }),
    );
    const candidates = await t.core.getMatchingCandidates(demoIds.requests[0]!);
    expect(candidates).toHaveLength(8);
    const keys = [
      'volunteerId',
      'supportedServices',
      'expertiseTags',
      'industryTags',
      'languages',
      'availableWindows',
      'supportedModes',
      'supportedAccessPreferences',
      'livedExperienceTags',
      'remainingWeeklyMinutes',
      'verified',
    ].sort();
    for (const candidate of candidates)
      expect(Object.keys(candidate).sort()).toEqual(keys);
    expect(JSON.stringify(candidates)).not.toContain('never-share');
    expect(candidates.some((v) => !v.verified)).toBe(true); // Member 2 applies hard filters.
  });
  it('subtracts booked intervals and reserves career-story minutes once', async () => {
    const match = (
      await t.core.saveMatches(demoIds.requests[1]!, [
        resultFor(t.volunteer.id),
      ])
    )[0]!;
    await t.core.createEngagement(t.volunteer, {
      match_id: match.id,
      scheduled_start: '2030-01-07T10:00:00+08:00',
      scheduled_end: '2030-01-07T10:25:00+08:00',
    });
    const candidate = (
      await t.core.getMatchingCandidates(demoIds.requests[0]!)
    ).find((v) => v.volunteerId === t.volunteer.id)!;
    expect(candidate.remainingWeeklyMinutes).toBe(50); // 90 - 15-minute offer - 25-minute teaching.
    expect(candidate.availableWindows[0]!.start).toBe(
      '2030-01-07T02:25:00.000Z',
    );
  });
  it('uses Singapore Monday boundaries for weekly minutes', () => {
    expect(weekStart('2030-01-06T23:59:00+08:00')).not.toBe(
      weekStart('2030-01-07T00:00:00+08:00'),
    );
    expect(weekStart('2030-01-07T00:00:00+08:00')).toBe(
      Date.parse('2030-01-06T16:00:00Z'),
    );
  });
});
