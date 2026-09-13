import { afterEach, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { useTestDatabase, demoIds, ama } from '../../core/tests/fixtures.js';
import { createApp } from '../../core/api/app.js';
import { demoAuth } from '../../core/auth/demo-auth.js';
import { createPlatform, registerMatchingRoutes } from '../index.js';
import { toMatchRequest, toVolunteerCandidate } from '../adapters.js';
import {
  matchVolunteers,
  rankCareerStoryOffers,
} from '../../matching/index.js';

describe('combined platform', () => {
  const t = useTestDatabase();
  const platform = () => createPlatform(t.db, { now: () => t.now });
  let app: FastifyInstance | undefined;
  const api = () => {
    if (!app) {
      const { core, matching } = platform();
      app = createApp(core, demoAuth(t.db, true, 'test'), (routes) =>
        registerMatchingRoutes(routes, matching),
      );
    }
    return app;
  };
  const headers = (id = t.participant.id) => ({ 'x-demo-user-id': id });
  afterEach(async () => {
    await app?.close();
    app = undefined;
  });

  it.each([0, 1, 2])(
    'generates and persists real engine results for seeded request %i',
    async (index) => {
      const request = await t.core.getRequest(demoIds.requests[index]!);
      const participant = (await t.db.get(
        'participant_profiles',
        request.participant_id,
      ))!;
      const owner = (await t.db.get('users', request.participant_id))!;
      const candidates = await t.core.getMatchingCandidates(request.id);
      const expected = matchVolunteers(
        toMatchRequest(request, participant),
        candidates.map(toVolunteerCandidate),
      );
      const matches = await platform().matching.generateMatches(
        owner,
        request.id,
      );
      expect(matches.length).toBeGreaterThan(0);
      expect(
        matches.map((m) => ({
          volunteerId: m.volunteer_id,
          score: m.score,
          reasons: m.reasons,
          compatibleWindows: m.suggested_windows,
        })),
      ).toEqual(expected);
      expect((await t.core.getRequest(request.id)).status).toBe('matched');
      expect(
        await t.db.list('matches', {
          request_id: request.id,
          status: 'suggested',
        }),
      ).toHaveLength(matches.length);
      const host = (await t.db.get('users', matches[0]!.volunteer_id))!;
      const booking =
        index === 1
          ? {
              scheduled_start: '2030-01-07T10:00:00+08:00',
              scheduled_end: '2030-01-07T10:25:00+08:00',
            }
          : {};
      expect(
        (
          await t.core.createEngagement(host, {
            match_id: matches[0]!.id,
            ...booking,
          })
        ).status,
      ).toBe('confirmed');
    },
  );

  it('requires full access support rather than recommending an unbookable volunteer', async () => {
    const request = await t.core.createRequest(t.participant, {
      ...ama,
      access_preferences: ['written_instructions', 'wheelchair_access'],
    });
    const matches = await platform().matching.generateMatches(
      t.participant,
      request.id,
    );
    expect(matches).toEqual([]);
    expect((await t.core.getRequest(request.id)).status).toBe('open');
  });

  it('persists readable reasons even with no preference overlap', async () => {
    await t.core.updateProfile(t.participant, t.participant.id, {
      languages: [],
    });
    const request = await t.core.createRequest(t.participant, ama);
    const matches = await platform().matching.generateMatches(
      t.participant,
      request.id,
    );
    expect(matches.length).toBeGreaterThan(0);
    expect(matches.every((m) => m.reasons.length > 0)).toBe(true);
  });

  it('expires old suggestions on regeneration and rejects accepted requests', async () => {
    const matching = platform().matching;
    const first = await matching.generateMatches(
      t.participant,
      demoIds.requests[0]!,
    );
    const second = await matching.generateMatches(
      t.participant,
      demoIds.requests[0]!,
    );
    expect((await t.db.get('matches', first[0]!.id))!.status).toBe('expired');
    await t.core.createEngagement(t.volunteer, { match_id: second[0]!.id });
    await expect(
      matching.generateMatches(t.participant, demoIds.requests[0]!),
    ).rejects.toMatchObject({ code: 'INVALID_TRANSITION' });
    expect((await t.db.get('matches', second[0]!.id))!.status).toBe('accepted');
  });

  it('does not suggest a live slot when the participant is already booked', async () => {
    const requestId = demoIds.requests[1]!;
    const matches = await platform().matching.generateMatches(
      t.otherParticipant,
      requestId,
    );
    await t.core.createEngagement(t.volunteer, {
      match_id: matches[0]!.id,
      scheduled_start: '2030-01-07T10:00:00+08:00',
      scheduled_end: '2030-01-07T10:25:00+08:00',
    });
    const { teaching } = await import('../../core/tests/fixtures.js');
    const request = await t.core.createRequest(t.otherParticipant, {
      ...teaching,
      availability_windows: [
        {
          start: '2030-01-07T10:00:00+08:00',
          end: '2030-01-07T10:25:00+08:00',
        },
      ],
    });
    expect(
      await platform().matching.generateMatches(t.otherParticipant, request.id),
    ).toEqual([]);
  });

  it('rejects expired requests before generating scores', async () => {
    const request = await t.core.createRequest(t.participant, {
      ...ama,
      deadline: '2029-12-31T00:00:00Z',
    });
    await expect(
      platform().matching.generateMatches(t.participant, request.id),
    ).rejects.toMatchObject({ code: 'DEADLINE_PASSED' });
    expect(await t.db.list('matches', { request_id: request.id })).toEqual([]);
  });

  it('ranks career stories separately and books a selected offer', async () => {
    const matching = platform().matching;
    const ranked = await matching.rankOffers(t.participant, {
      preferred_mode: 'live_online',
      availability_windows: [
        {
          start: '2030-01-08T10:00:00+08:00',
          end: '2030-01-08T13:00:00+08:00',
        },
      ],
    });
    expect(ranked[0]!.offerId).toBe(demoIds.offers[0]);
    expect(ranked.every((o) => o.reasons.length > 0)).toBe(true);
    expect(await t.db.list('matches')).toEqual([]);
    await t.core.createEngagement(t.participant, {
      offer_id: ranked[0]!.offerId,
    });
    const remaining = await matching.rankOffers(t.otherParticipant);
    expect(remaining.some((o) => o.offerId === ranked[0]!.offerId)).toBe(false);
  });

  it('excludes unavailable career-story hosts and past offers', async () => {
    await t.db.transaction((repo) =>
      repo.update('volunteer_profiles', demoIds.volunteers[0]!, {
        verification_status: 'pending',
      }),
    );
    const matching = platform().matching;
    expect(
      (await matching.rankOffers(t.participant)).some(
        (o) => o.offerId === demoIds.offers[0],
      ),
    ).toBe(false);
    t.now = new Date('2030-01-09T00:00:00Z');
    expect(await matching.rankOffers(t.participant)).toEqual([]);
  });

  it('returns an explanation even for a career story with no matching preferences', () => {
    const ranked = rankCareerStoryOffers(
      {
        participantId: 'p',
        topicTags: [],
        industryTags: [],
        preferredMode: 'async',
        availabilityWindows: [],
        languages: [],
        accessPreferences: [],
      },
      [
        {
          offerId: 'o',
          volunteerId: 'v',
          industryTags: [],
          topicTags: [],
          mode: 'live_online',
          startsAt: '2030-01-08T02:00:00Z',
          endsAt: '2030-01-08T02:15:00Z',
          capacityRemaining: 1,
          accessFeatures: [],
          languages: [],
        },
      ],
    );
    expect(ranked[0]!.reasons.length).toBeGreaterThan(0);
  });

  it('protects generated matching endpoints with authentication and ownership checks', async () => {
    const url = `/api/requests/${demoIds.requests[0]}/matches/generate`;
    expect((await api().inject({ method: 'POST', url })).statusCode).toBe(401);
    expect(
      (
        await api().inject({
          method: 'POST',
          url,
          headers: headers(t.otherParticipant.id),
          payload: {},
        })
      ).statusCode,
    ).toBe(403);
    expect(
      (
        await api().inject({
          method: 'POST',
          url,
          headers: headers(),
          payload: { score: 100 },
        })
      ).statusCode,
    ).toBe(400);
    expect(
      (
        await api().inject({
          method: 'POST',
          url,
          headers: headers(),
          payload: { limit: 0 },
        })
      ).statusCode,
    ).toBe(400);
    const response = await api().inject({
      method: 'POST',
      url,
      headers: headers(),
      payload: { limit: 1 },
    });
    expect(response.statusCode).toBe(201);
    expect(response.json().data).toHaveLength(1);
    expect(response.json().error).toBeNull();
    const forbidden = await api().inject({
      method: 'POST',
      url,
      headers: headers(t.volunteer.id),
      payload: {},
    });
    expect(forbidden.statusCode).toBe(403);
    const rank = await api().inject({
      method: 'POST',
      url: '/api/offers/rank',
      headers: headers(),
      payload: { limit: 1 },
    });
    expect(rank.statusCode).toBe(200);
    expect(rank.json().data).toHaveLength(1);
    expect(
      (
        await api().inject({
          method: 'POST',
          url: '/api/offers/rank',
          headers: headers(t.volunteer.id),
          payload: {},
        })
      ).statusCode,
    ).toBe(403);
  });
});
