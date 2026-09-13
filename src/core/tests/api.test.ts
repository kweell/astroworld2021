import { afterEach, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { createApp } from '../api/app.js';
import { demoAuth } from '../auth/demo-auth.js';
import { useTestDatabase, ama, demoIds, offer, resultFor } from './fixtures.js';
describe('JSON API', () => {
  const t = useTestDatabase();
  let app: FastifyInstance | undefined;
  const api = () => (app ??= createApp(t.core, demoAuth(t.db, true, 'test')));
  const headers = (id: string) => ({ 'x-demo-user-id': id });
  afterEach(async () => {
    await app?.close();
    app = undefined;
  });
  it('health is public; private endpoints require authentication', async () => {
    const health = await api().inject({ method: 'GET', url: '/api/health' });
    expect(health.json()).toEqual({
      data: { status: 'ok', timezone: 'Asia/Singapore' },
      error: null,
    });
    const me = await api().inject({ method: 'GET', url: '/api/me' });
    expect(me.statusCode).toBe(401);
    expect(me.json()).toMatchObject({
      data: null,
      error: { code: 'UNAUTHENTICATED' },
    });
  });
  it('validates IDs, unknown keys, and malformed JSON with consistent errors', async () => {
    const badId = await api().inject({
      method: 'GET',
      url: '/api/requests/not-an-id',
      headers: headers(t.participant.id),
    });
    expect(badId.statusCode).toBe(400);
    const badBody = await api().inject({
      method: 'POST',
      url: '/api/requests',
      headers: headers(t.participant.id),
      payload: { ...ama, participant_id: t.otherParticipant.id },
    });
    expect(badBody.statusCode).toBe(400);
    const badJson = await api().inject({
      method: 'POST',
      url: '/api/requests',
      headers: {
        ...headers(t.participant.id),
        'content-type': 'application/json',
      },
      payload: '{bad',
    });
    expect(badJson.statusCode).toBe(400);
    expect(badJson.json().data).toBeNull();
    expect((await api().inject('/api/missing')).statusCode).toBe(404);
  });
  it('covers profile, request, matching, engagement and feedback endpoints end to end', async () => {
    const call = (
      method: 'GET' | 'POST' | 'PATCH',
      url: string,
      userId: string,
      payload?: object,
    ) =>
      api().inject({
        method,
        url,
        headers: headers(userId),
        ...(payload ? { payload } : {}),
      });
    expect(
      (await call('GET', '/api/me', t.participant.id)).json().data.user.id,
    ).toBe(t.participant.id);
    expect(
      (
        await call('GET', `/api/profiles/${t.volunteer.id}`, t.participant.id)
      ).json().data.user,
    ).not.toHaveProperty('email');
    expect(
      (
        await call(
          'PATCH',
          `/api/profiles/${t.participant.id}`,
          t.participant.id,
          { time_constraints: 'After classes' },
        )
      ).statusCode,
    ).toBe(200);
    const created = await call('POST', '/api/requests', t.participant.id, ama);
    expect(created.statusCode).toBe(201);
    const requestId = created.json().data.id;
    expect(
      (
        await call('PATCH', `/api/requests/${requestId}`, t.participant.id, {
          title: 'Updated',
        })
      ).statusCode,
    ).toBe(200);
    expect(
      (await call('GET', `/api/requests/${requestId}`, t.participant.id))
        .statusCode,
    ).toBe(200);
    expect(
      (
        await call(
          'GET',
          `/api/requests?participantId=${t.participant.id}&status=open&serviceType=ask_me_anything`,
          t.participant.id,
        )
      ).json().data.length,
    ).toBe(2);
    const matches = await call('POST', '/api/matches', t.admin.id, {
      request_id: requestId,
      results: [resultFor(t.volunteer.id)],
    });
    expect(matches.statusCode).toBe(201);
    expect(
      (await call('GET', `/api/requests/${requestId}/matches`, t.volunteer.id))
        .statusCode,
    ).toBe(200);
    const accepted = await call(
      'PATCH',
      `/api/matches/${matches.json().data[0].id}`,
      t.volunteer.id,
      { status: 'accepted' },
    );
    expect(accepted.statusCode).toBe(200);
    const engagementId = accepted.json().data.engagement.id;
    expect(
      (await call('GET', `/api/engagements/${engagementId}`, t.participant.id))
        .statusCode,
    ).toBe(200);
    expect(
      (
        await call(
          'PATCH',
          `/api/engagements/${engagementId}`,
          t.participant.id,
          { status: 'completed' },
        )
      ).statusCode,
    ).toBe(200);
    expect(
      (
        await call('POST', '/api/feedback', t.participant.id, {
          engagement_id: engagementId,
          helpful: true,
        })
      ).statusCode,
    ).toBe(201);
  });
  it('covers offer endpoints and booking conflict responses', async () => {
    const created = await api().inject({
      method: 'POST',
      url: '/api/offers',
      headers: headers(t.volunteer.id),
      payload: offer,
    });
    expect(created.statusCode).toBe(201);
    const id = created.json().data.id;
    expect(
      (
        await api().inject({
          method: 'GET',
          url: '/api/offers',
          headers: headers(t.participant.id),
        })
      ).json().data,
    ).toHaveLength(4);
    expect(
      (
        await api().inject({
          method: 'GET',
          url: `/api/offers/${id}`,
          headers: headers(t.participant.id),
        })
      ).statusCode,
    ).toBe(200);
    expect(
      (
        await api().inject({
          method: 'PATCH',
          url: `/api/offers/${id}`,
          headers: headers(t.volunteer.id),
          payload: { title: 'New title' },
        })
      ).statusCode,
    ).toBe(200);
    expect(
      (
        await api().inject({
          method: 'POST',
          url: '/api/engagements',
          headers: headers(t.participant.id),
          payload: { offer_id: id },
        })
      ).statusCode,
    ).toBe(201);
    const conflict = await api().inject({
      method: 'POST',
      url: '/api/engagements',
      headers: headers(t.otherParticipant.id),
      payload: { offer_id: id },
    });
    expect(conflict.statusCode).toBe(409);
    expect(conflict.json()).toMatchObject({
      data: null,
      error: { code: 'OFFER_FULL' },
    });
  });
  it('rejects participant career-story requests at the API boundary', async () => {
    const response = await api().inject({
      method: 'POST',
      url: '/api/requests',
      headers: headers(demoIds.participants[0]!),
      payload: { ...ama, service_type: 'career_story' },
    });
    expect(response.statusCode).toBe(400);
    expect(response.json().error.code).toBe('VALIDATION_ERROR');
  });
});
