import { describe, expect, it } from 'vitest';
import { demoAuth } from '../auth/demo-auth.js';
import { useTestDatabase, ama, demoIds, offer, resultFor } from './fixtures.js';
describe('authorization and privacy', () => {
  const t = useTestDatabase();
  it('participants cannot publish offers and volunteers cannot create requests', async () => {
    await expect(
      t.core.createOffer(t.participant, offer),
    ).rejects.toMatchObject({ code: 'FORBIDDEN' });
    await expect(t.core.createRequest(t.volunteer, ama)).rejects.toMatchObject({
      code: 'FORBIDDEN',
    });
  });
  it('rejects other participants reading or editing requests', async () => {
    const request = await t.core.createRequest(t.participant, ama);
    await expect(
      t.core.getRequest(request.id, t.otherParticipant),
    ).rejects.toMatchObject({ code: 'FORBIDDEN' });
    await expect(
      t.core.updateRequest(t.otherParticipant, request.id, {
        title: 'Changed',
      }),
    ).rejects.toMatchObject({ code: 'FORBIDDEN' });
    expect(
      await t.core.listRequests(t.otherParticipant, {}),
    ).not.toContainEqual(expect.objectContaining({ id: request.id }));
  });
  it('volunteers cannot self-verify, change roles, or edit others’ profiles', async () => {
    await expect(
      t.core.updateProfile(t.volunteer, t.volunteer.id, {
        verification_status: 'verified',
      }),
    ).rejects.toMatchObject({ code: 'FORBIDDEN' });
    await expect(
      t.core.updateProfile(t.participant, t.participant.id, { role: 'admin' }),
    ).rejects.toThrow();
    await expect(
      t.core.updateProfile(t.participant, t.otherParticipant.id, {
        display_name: 'Changed',
      }),
    ).rejects.toMatchObject({ code: 'FORBIDDEN' });
  });
  it('only operators may persist match scores', async () => {
    await expect(
      t.core.createMatches(t.participant, {
        request_id: demoIds.requests[0],
        results: [resultFor(t.volunteer.id)],
      }),
    ).rejects.toMatchObject({ code: 'FORBIDDEN' });
  });
  it('reveals contact details only to self or an accepted engagement counterpart', async () => {
    await t.db.transaction((repo) =>
      repo.update('users', t.volunteer.id, { email: 'mentor@example.invalid' }),
    );
    expect(
      (await t.core.getProfile(t.participant, t.volunteer.id)).user,
    ).not.toHaveProperty('email');
    const matches = await t.core.saveMatches(demoIds.requests[0]!, [
      resultFor(t.volunteer.id),
    ]);
    expect(
      (await t.core.getProfile(t.participant, t.volunteer.id)).user,
    ).not.toHaveProperty('email');
    await t.core.createEngagement(t.volunteer, { match_id: matches[0]!.id });
    expect(
      (await t.core.getProfile(t.participant, t.volunteer.id)).user,
    ).toHaveProperty('email', 'mentor@example.invalid');
    expect(
      (await t.core.getProfile(t.otherParticipant, t.volunteer.id)).user,
    ).not.toHaveProperty('email');
  });
  it('keeps participant preferences private to the owner', async () => {
    expect(
      (await t.core.getProfile(t.volunteer, t.participant.id)).profile,
    ).toBeNull();
  });
  it('demo auth requires a known identity and cannot run in production', async () => {
    expect(() => demoAuth(t.db, true, 'production')).toThrow();
    expect(() => demoAuth(t.db, false, 'development')).toThrow();
    await expect(
      demoAuth(t.db, true, 'test').authenticate({}),
    ).rejects.toMatchObject({ code: 'UNAUTHENTICATED' });
    expect(
      (
        await demoAuth(t.db, true, 'test').authenticate({
          'x-demo-user-id': t.participant.id,
        })
      ).id,
    ).toBe(t.participant.id);
  });
});
