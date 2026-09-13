import { describe, expect, it } from 'vitest';
import { assertTransition } from '../domain/lifecycle.js';
import { useTestDatabase, ama, demoIds, resultFor } from './fixtures.js';
describe('request and match lifecycle', () => {
  const t = useTestDatabase();
  it.each([
    ['request', 'open', 'completed'],
    ['request', 'cancelled', 'open'],
    ['offer', 'draft', 'full'],
    ['match', 'declined', 'accepted'],
    ['engagement', 'completed', 'confirmed'],
  ] as const)('rejects %s %s → %s', (kind, from, to) => {
    expect(() => assertTransition(kind, from, to)).toThrow();
  });
  it('invalid direct SQL state jumps are rejected by migrations', async () => {
    await expect(
      t.sql.query(
        "UPDATE micro_access.service_requests SET status = 'completed' WHERE id = $1",
        [demoIds.requests[0]],
      ),
    ).rejects.toThrow('Invalid lifecycle transition');
  });
  it('editing a matched request expires suggestions and reopens it', async () => {
    const matches = await t.core.saveMatches(demoIds.requests[0]!, [
      resultFor(t.volunteer.id),
    ]);
    const updated = await t.core.updateRequest(
      t.participant,
      demoIds.requests[0]!,
      { title: 'Updated question' },
    );
    expect(updated.status).toBe('open');
    expect(updated.duration_minutes).toBe(10);
    expect(updated.access_preferences).toEqual(['simple_language']);
    expect((await t.db.get('matches', matches[0]!.id))!.status).toBe('expired');
  });
  it('PATCH revalidates combined request fields', async () => {
    await expect(
      t.core.updateRequest(t.participant, demoIds.requests[0]!, {
        duration_minutes: 30,
      }),
    ).rejects.toThrow();
    await expect(
      t.core.updateRequest(t.participant, demoIds.requests[0]!, {
        status: 'completed',
      }),
    ).rejects.toThrow();
  });
  it('declining the last suggested match reopens the request', async () => {
    const matches = await t.core.saveMatches(demoIds.requests[0]!, [
      resultFor(t.volunteer.id),
    ]);
    await t.core.updateMatch(t.volunteer, matches[0]!.id, {
      status: 'declined',
    });
    expect((await t.core.getRequest(demoIds.requests[0]!)).status).toBe('open');
  });
  it('cancellation expires suggestions and prevents acceptance', async () => {
    const matches = await t.core.saveMatches(demoIds.requests[0]!, [
      resultFor(t.volunteer.id),
    ]);
    await t.core.updateRequest(t.participant, demoIds.requests[0]!, {
      status: 'cancelled',
    });
    await expect(
      t.core.createEngagement(t.volunteer, { match_id: matches[0]!.id }),
    ).rejects.toMatchObject({ code: 'INVALID_TRANSITION' });
  });
  it('empty results leave a request open and repeated seeds preserve edits', async () => {
    const { seedDatabase } = await import('../seed/seed.js');
    await t.core.updateRequest(t.participant, demoIds.requests[0]!, {
      title: 'Preserve my edit',
    });
    await seedDatabase(t.db);
    await t.core.saveMatches(demoIds.requests[0]!, []);
    expect((await t.core.getRequest(demoIds.requests[0]!)).title).toBe(
      'Preserve my edit',
    );
    expect((await t.db.list('users')).length).toBe(16);
  });
  it('failed match persistence rolls back earlier changes', async () => {
    const request = await t.core.createRequest(t.participant, ama);
    await expect(
      t.core.saveMatches(request.id, [
        resultFor('00000000-0000-4000-8000-000000009999'),
      ]),
    ).rejects.toMatchObject({ code: 'NOT_FOUND' });
    expect((await t.core.getRequest(request.id)).status).toBe('open');
    expect(await t.db.list('matches', { request_id: request.id })).toHaveLength(
      0,
    );
  });
});
