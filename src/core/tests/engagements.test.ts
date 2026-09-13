import { describe, expect, it } from 'vitest';
import {
  useTestDatabase,
  ama,
  demoIds,
  resultFor,
  teaching,
} from './fixtures.js';
describe('request acceptance', () => {
  const t = useTestDatabase();
  const suggest = async (
    requestId = demoIds.requests[0]!,
    volunteerId = t.volunteer.id,
  ) => (await t.core.saveMatches(requestId, [resultFor(volunteerId)]))[0]!;
  it('atomically accepts a match and creates an engagement', async () => {
    const match = await suggest();
    const result = await t.core.updateMatch(t.volunteer, match.id, {
      status: 'accepted',
    });
    expect(result.engagement).toMatchObject({
      status: 'confirmed',
      mode: 'async',
      scheduled_start: null,
    });
    expect((await t.core.getRequest(match.request_id)).status).toBe('accepted');
    expect((await t.db.get('matches', match.id))!.status).toBe('accepted');
    await expect(
      t.core.createEngagement(t.volunteer, { match_id: match.id }),
    ).rejects.toMatchObject({ code: 'INVALID_TRANSITION' });
  });
  it('only the suggested volunteer can accept', async () => {
    const match = await suggest();
    await expect(
      t.core.createEngagement(t.participant, { match_id: match.id }),
    ).rejects.toMatchObject({ code: 'FORBIDDEN' });
    const other = (await t.db.get('users', demoIds.volunteers[1]!))!;
    await expect(
      t.core.createEngagement(other, { match_id: match.id }),
    ).rejects.toMatchObject({ code: 'FORBIDDEN' });
  });
  it('cannot accept an unsupported service even if integration suggests it', async () => {
    const volunteer = (await t.db.get('users', demoIds.volunteers[1]!))!;
    const match = await suggest(demoIds.requests[0]!, volunteer.id);
    await expect(
      t.core.createEngagement(volunteer, { match_id: match.id }),
    ).rejects.toMatchObject({ code: 'UNSUPPORTED_SERVICE' });
    expect((await t.core.getRequest(match.request_id)).status).toBe('matched');
  });
  it('rejects unverified volunteers and unsupported access preferences', async () => {
    const volunteer = (await t.db.get('users', demoIds.volunteers[6]!))!;
    const match = await suggest(demoIds.requests[0]!, volunteer.id);
    await expect(
      t.core.createEngagement(volunteer, { match_id: match.id }),
    ).rejects.toMatchObject({ code: 'VOLUNTEER_UNVERIFIED' });
    const request = await t.core.createRequest(t.participant, {
      ...ama,
      access_preferences: ['wheelchair_access'],
    });
    const another = await suggest(request.id);
    await expect(
      t.core.createEngagement(t.volunteer, { match_id: another.id }),
    ).rejects.toMatchObject({ code: 'ACCESS_UNSUPPORTED' });
  });
  it('requires a live slot of the right duration within both users’ availability', async () => {
    const match = await suggest(demoIds.requests[1]!);
    await expect(
      t.core.createEngagement(t.volunteer, { match_id: match.id }),
    ).rejects.toMatchObject({ code: 'VALIDATION_ERROR' });
    await expect(
      t.core.createEngagement(t.volunteer, {
        match_id: match.id,
        scheduled_start: '2030-01-07T12:00:00+08:00',
        scheduled_end: '2030-01-07T12:25:00+08:00',
      }),
    ).rejects.toMatchObject({ code: 'AVAILABILITY_CONFLICT' });
    const engagement = await t.core.createEngagement(t.volunteer, {
      match_id: match.id,
      scheduled_start: '2030-01-07T10:00:00+08:00',
      scheduled_end: '2030-01-07T10:25:00+08:00',
    });
    expect(engagement.scheduled_start).toBe('2030-01-07T02:00:00.000Z');
    await expect(
      t.core.updateEngagement(t.volunteer, engagement.id, {
        status: 'completed',
      }),
    ).rejects.toMatchObject({ code: 'SESSION_NOT_ENDED' });
  });
  it('prevents overlapping live engagements', async () => {
    const first = await suggest(demoIds.requests[1]!);
    const booking = {
      scheduled_start: '2030-01-07T10:00:00+08:00',
      scheduled_end: '2030-01-07T10:25:00+08:00',
    };
    await t.core.createEngagement(t.volunteer, {
      match_id: first.id,
      ...booking,
    });
    const request = await t.core.createRequest(t.participant, teaching);
    const second = await suggest(request.id);
    await expect(
      t.core.createEngagement(t.volunteer, { match_id: second.id, ...booking }),
    ).rejects.toMatchObject({ code: 'BOOKING_CONFLICT' });
  });
  it('requires either to be resolved explicitly', async () => {
    const request = await t.core.createRequest(t.participant, {
      ...ama,
      preferred_mode: 'either',
    });
    const match = await suggest(request.id);
    await expect(
      t.core.createEngagement(t.volunteer, { match_id: match.id }),
    ).rejects.toMatchObject({ code: 'VALIDATION_ERROR' });
    expect(
      (
        await t.core.createEngagement(t.volunteer, {
          match_id: match.id,
          mode: 'async',
        })
      ).mode,
    ).toBe('async');
  });
  it('cancellation updates the request and prevents further edits', async () => {
    const match = await suggest();
    const engagement = await t.core.createEngagement(t.volunteer, {
      match_id: match.id,
    });
    await t.core.updateEngagement(t.participant, engagement.id, {
      status: 'cancelled',
    });
    expect((await t.core.getRequest(match.request_id)).status).toBe(
      'cancelled',
    );
    await expect(
      t.core.updateEngagement(t.volunteer, engagement.id, {
        status: 'completed',
      }),
    ).rejects.toMatchObject({ code: 'INVALID_TRANSITION' });
  });
  it('honours remaining weekly minutes', async () => {
    await t.db.transaction((repo) =>
      repo.update('volunteer_profiles', t.volunteer.id, {
        max_weekly_minutes: 15,
      }),
    );
    const match = await suggest(); // Published career story already reserves these 15 minutes.
    await expect(
      t.core.createEngagement(t.volunteer, { match_id: match.id }),
    ).rejects.toMatchObject({ code: 'WEEKLY_CAPACITY_EXCEEDED' });
  });
  it('accepts at most once under concurrent submissions', async () => {
    const match = await suggest();
    const outcomes = await Promise.allSettled(
      Array.from({ length: 4 }, () =>
        t.core.createEngagement(t.volunteer, { match_id: match.id }),
      ),
    );
    expect(outcomes.filter((o) => o.status === 'fulfilled')).toHaveLength(1);
    expect(
      await t.db.list('engagements', { request_id: match.request_id }),
    ).toHaveLength(1);
  });
});
