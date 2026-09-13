import { afterEach, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { createApp } from '../../core/api/app.js';
import { demoAuth } from '../../core/auth/demo-auth.js';
import {
  useTestDatabase,
  ama,
  demoIds,
  teaching,
} from '../../core/tests/fixtures.js';
import { createPlatform } from '../index.js';

describe('automatic request notifications', () => {
  const t = useTestDatabase();
  const platform = () => createPlatform(t.db, { now: () => t.now });
  let app: FastifyInstance | undefined;
  function api() {
    return (app ??= createApp(platform().core, demoAuth(t.db, true, 'test')));
  }
  const headers = (id: string) => ({ 'x-demo-user-id': id });
  afterEach(async () => {
    await app?.close();
    app = undefined;
  });

  it('creates matches and notifications immediately and lets a volunteer accept from the notification', async () => {
    const response = await api().inject({
      method: 'POST',
      url: '/api/requests',
      headers: headers(t.participant.id),
      payload: { ...ama, topic_tags: [' PYTHON ', 'python'] },
    });
    expect(response.statusCode).toBe(201);
    const request = response.json().data;
    expect(request).toMatchObject({
      status: 'matched',
      topic_tags: ['python'],
    });
    const notifications = (
      await api().inject({
        url: '/api/notifications',
        headers: headers(t.volunteer.id),
      })
    ).json().data;
    expect(notifications).toEqual([
      expect.objectContaining({
        request_id: request.id,
        read_at: null,
        matching_topics: ['python'],
      }),
    ]);
    expect(
      (
        await api().inject({
          url: `/api/requests/${request.id}`,
          headers: headers(t.volunteer.id),
        })
      ).statusCode,
    ).toBe(200);
    expect(
      (
        await api().inject({
          url: '/api/requests',
          headers: headers(t.volunteer.id),
        })
      )
        .json()
        .data.some((r: { id: string }) => r.id === request.id),
    ).toBe(true);
    const accepted = await api().inject({
      method: 'PATCH',
      url: `/api/matches/${notifications[0].match_id}`,
      headers: headers(t.volunteer.id),
      payload: { status: 'accepted', mode: 'async' },
    });
    expect(accepted.statusCode).toBe(200);
    expect(accepted.json().data.engagement.status).toBe('confirmed');
    expect(await platform().core.listNotifications(t.volunteer)).toEqual([]);
  });

  it('notifies every eligible topic match, but not unrelated or unverified volunteers', async () => {
    const other = (await t.db.get('users', demoIds.volunteers[3]!))!;
    await t.core.updateProfile(other, other.id, { expertise_tags: ['python'] });
    await t.core.updateProfile(t.admin, demoIds.volunteers[6]!, {
      expertise_tags: ['python'],
    });
    const request = await platform().core.createRequest(t.participant, ama);
    const notifications = await t.db.list('notifications', {
      request_id: request.id,
    });
    expect(notifications.map((n) => n.recipient_id).sort()).toEqual(
      [t.volunteer.id, other.id].sort(),
    );
    expect(
      (await t.db.list('matches', { request_id: request.id }))
        .map((m) => m.volunteer_id)
        .sort(),
    ).toEqual([t.volunteer.id, other.id].sort());
  });

  it('supports custom interests and leaves unmatched requests open', async () => {
    const core = platform().core;
    const request = await core.createRequest(t.participant, {
      ...ama,
      topic_tags: ['Robotics'],
    });
    expect(request.status).toBe('open');
    expect(await t.db.list('notifications')).toEqual([]);
    await core.updateProfile(t.volunteer, t.volunteer.id, {
      expertise_tags: [' ROBOTICS '],
    });
    await core.updateRequest(t.participant, request.id, {
      details: 'Help me build a robotics project.',
    });
    expect(await core.listNotifications(t.volunteer)).toEqual([
      expect.objectContaining({
        request_id: request.id,
        matching_topics: ['robotics'],
      }),
    ]);
  });

  it('persists read status, avoids duplicates on regeneration, and scopes access to the recipient', async () => {
    const { core, matching } = platform();
    const request = await core.createRequest(t.participant, ama);
    const notification = (await core.listNotifications(t.volunteer))[0]!;
    expect((await api().inject('/api/notifications')).statusCode).toBe(401);
    expect(
      (
        await api().inject({
          url: '/api/notifications',
          headers: headers(t.participant.id),
        })
      ).statusCode,
    ).toBe(403);
    expect(
      (
        await api().inject({
          method: 'PATCH',
          url: `/api/notifications/${notification.id}`,
          headers: headers(demoIds.volunteers[1]!),
          payload: { read: true },
        })
      ).statusCode,
    ).toBe(403);
    for (const payload of [
      { read: false },
      { read: true, recipient_id: t.participant.id },
    ]) {
      expect(
        (
          await api().inject({
            method: 'PATCH',
            url: `/api/notifications/${notification.id}`,
            headers: headers(t.volunteer.id),
            payload,
          })
        ).statusCode,
      ).toBe(400);
    }
    expect(
      (
        await api().inject({
          method: 'PATCH',
          url: '/api/notifications/bad-id',
          headers: headers(t.volunteer.id),
          payload: { read: true },
        })
      ).statusCode,
    ).toBe(400);
    const read = await core.readNotification(t.volunteer, notification.id, {
      read: true,
    });
    await matching.generateMatches(t.participant, request.id);
    expect(
      await t.db.list('notifications', {
        recipient_id: t.volunteer.id,
        request_id: request.id,
      }),
    ).toHaveLength(1);
    expect(
      (await platform().core.listNotifications(t.volunteer))[0],
    ).toMatchObject({ id: notification.id, read_at: read.read_at });
    expect(
      (
        await api().inject({
          url: `/api/notifications?recipient_id=${t.volunteer.id}`,
          headers: headers(demoIds.volunteers[1]!),
        })
      ).json().data,
    ).toEqual([]);
  });

  it('edits submitted topics repeatedly, replaces invitations, and books only the latest match', async () => {
    const core = platform().core;
    const roboticsVolunteer = (await t.db.get(
      'users',
      demoIds.volunteers[1]!,
    ))!;
    await t.core.updateProfile(roboticsVolunteer, roboticsVolunteer.id, {
      expertise_tags: ['robotics lab'],
      supported_services: ['ask_me_anything'],
      supported_modes: ['async'],
    });
    const request = await core.createRequest(t.participant, ama);
    const original = (await core.listNotifications(t.volunteer))[0]!;
    await core.readNotification(t.volunteer, original.id, { read: true });

    async function edit(topics: string[]) {
      const response = await api().inject({
        method: 'PATCH',
        url: `/api/requests/${request.id}`,
        headers: headers(t.participant.id),
        payload: { topic_tags: topics, industry_tags: [' Research '] },
      });
      expect(response.statusCode).toBe(200);
      expect(response.json().data).toMatchObject({
        id: request.id,
        title: request.title,
        details: request.details,
        created_at: request.created_at,
        industry_tags: ['research'],
      });
      return response.json().data;
    }

    const saved = await edit([' ROBOTICS   LAB ', 'robotics lab']);
    expect(saved.topic_tags).toEqual(['robotics lab']);
    expect(await core.listNotifications(t.volunteer)).toEqual([]);
    const roboticsNotice = (
      await core.listNotifications(roboticsVolunteer)
    )[0]!;
    expect(roboticsNotice).toMatchObject({
      request_id: request.id,
      matching_topics: ['robotics lab'],
      read_at: null,
    });
    expect(
      (
        await api().inject({
          url: `/api/requests/${request.id}`,
          headers: headers(t.volunteer.id),
        })
      ).statusCode,
    ).toBe(403);
    expect((await t.db.get('matches', original.match_id))!.status).toBe(
      'expired',
    );
    await expect(
      core.updateMatch(t.volunteer, original.match_id, {
        status: 'accepted',
        mode: 'async',
      }),
    ).rejects.toMatchObject({ code: 'INVALID_TRANSITION' });

    await edit(['Python']);
    expect(await core.listNotifications(roboticsVolunteer)).toEqual([]);
    const renewed = (await core.listNotifications(t.volunteer))[0]!;
    expect(renewed).toMatchObject({
      id: original.id,
      read_at: null,
      matching_topics: ['python'],
    });
    expect(renewed.match_id).not.toBe(original.match_id);
    expect(
      await t.db.list('notifications', {
        request_id: request.id,
        recipient_id: t.volunteer.id,
      }),
    ).toHaveLength(1);

    await edit(['robotics lab']);
    const latest = (await core.listNotifications(roboticsVolunteer))[0]!;
    expect(latest.id).toBe(roboticsNotice.id);
    expect(latest.match_id).not.toBe(roboticsNotice.match_id);
    const accepted = await core.updateMatch(
      roboticsVolunteer,
      latest.match_id,
      { status: 'accepted', mode: 'async' },
    );
    expect(accepted.engagement).toMatchObject({
      request_id: request.id,
      volunteer_id: roboticsVolunteer.id,
      status: 'confirmed',
    });
  });

  it('rejects invalid or unauthorized topic edits without disturbing saved topics or invitations', async () => {
    const core = platform().core;
    const request = await core.createRequest(t.participant, ama);
    const notice = (await core.listNotifications(t.volunteer))[0]!;
    await core.readNotification(t.volunteer, notice.id, { read: true });
    const before = await core.listNotifications(t.volunteer);
    for (const topic_tags of [
      [],
      [' '],
      ['Others'],
      ['<script>'],
      ['x'.repeat(81)],
    ]) {
      const response = await api().inject({
        method: 'PATCH',
        url: `/api/requests/${request.id}`,
        headers: headers(t.participant.id),
        payload: { topic_tags },
      });
      expect(response.statusCode).toBe(400);
    }
    for (const actor of [t.otherParticipant, t.volunteer]) {
      const response = await api().inject({
        method: 'PATCH',
        url: `/api/requests/${request.id}`,
        headers: headers(actor.id),
        payload: { topic_tags: ['robotics'] },
      });
      expect(response.statusCode).toBe(403);
    }
    expect(await core.getRequest(request.id)).toEqual(request);
    expect(await core.listNotifications(t.volunteer)).toEqual(before);
    expect((await t.db.get('matches', notice.match_id))!.status).toBe(
      'suggested',
    );
    await core.updateMatch(t.volunteer, notice.match_id, {
      status: 'accepted',
      mode: 'async',
    });
    const booked = await api().inject({
      method: 'PATCH',
      url: `/api/requests/${request.id}`,
      headers: headers(t.participant.id),
      payload: { topic_tags: ['robotics'] },
    });
    expect(booked.json().error.code).toBe('INVALID_TRANSITION');
    expect((await core.getRequest(request.id)).topic_tags).toEqual(['python']);
  });

  it('refreshes notifications for edits and removes cancelled, declined, or expired opportunities', async () => {
    const core = platform().core;
    const request = await core.createRequest(t.participant, {
      ...ama,
      deadline: '2030-01-08T00:00:00Z',
    });
    const notification = (await core.listNotifications(t.volunteer))[0]!;
    await core.readNotification(t.volunteer, notification.id, { read: true });
    await core.updateRequest(t.participant, request.id, {
      title: 'An updated question',
    });
    expect((await core.listNotifications(t.volunteer))[0]).toMatchObject({
      read_at: null,
      request_title: 'An updated question',
    });
    await core.updateMatch(
      t.volunteer,
      (await core.listNotifications(t.volunteer))[0]!.match_id,
      { status: 'declined' },
    );
    expect(await core.listNotifications(t.volunteer)).toEqual([]);
    await core.updateRequest(t.participant, request.id, {
      title: 'Updated again',
    });
    t.now = new Date('2030-01-09T00:00:00Z');
    expect(await core.listNotifications(t.volunteer)).toEqual([]);
    await core.updateRequest(t.participant, request.id, {
      status: 'cancelled',
    });
    expect(await core.listNotifications(t.volunteer)).toEqual([]);
  });

  it('notifies exact topic matches before support or availability is confirmed, and still validates acceptance', async () => {
    const core = platform().core;
    const request = await core.createRequest(t.participant, {
      ...ama,
      access_preferences: ['quiet_environment'],
    });
    const notice = (await core.listNotifications(t.volunteer))[0]!;
    expect(notice.request_id).toBe(request.id);
    const review = (await core.listMatches(t.volunteer, request.id))[0]!;
    expect(review.booking.ready).toBe(false);
    expect(review.booking.missing_access_preferences).toEqual([
      'quiet_environment',
    ]);
    await expect(
      core.updateMatch(t.volunteer, notice.match_id, { status: 'accepted' }),
    ).rejects.toMatchObject({ code: 'ACCESS_UNSUPPORTED' });
    const profile = (await t.db.get('volunteer_profiles', t.volunteer.id))!;
    await core.updateProfile(t.volunteer, t.volunteer.id, {
      supported_access_preferences: [
        ...profile.supported_access_preferences,
        'quiet_environment',
      ],
    });
    expect(
      (await core.listMatches(t.volunteer, request.id))[0]!.booking.ready,
    ).toBe(true);
    expect(
      (
        await core.updateMatch(t.volunteer, notice.match_id, {
          status: 'accepted',
        })
      ).engagement?.status,
    ).toBe('confirmed');
    const live = await core.createRequest(t.participant, {
      ...teaching,
      availability_windows: [
        { start: '2030-01-10T00:00:00Z', end: '2030-01-10T01:00:00Z' },
      ],
    });
    expect(
      (await core.listNotifications(t.volunteer)).some(
        (n) => n.request_id === live.id,
      ),
    ).toBe(true);
    expect(
      (await core.listMatches(t.volunteer, live.id))[0]!.booking.issues,
    ).toContain('No sufficient availability overlap for a live interaction');
    const liveMatch = (await core.listMatches(t.volunteer, live.id))[0]!;
    await expect(
      core.updateMatch(t.volunteer, liveMatch.id, {
        status: 'accepted',
        scheduled_start: '2030-01-10T00:00:00Z',
        scheduled_end: '2030-01-10T00:25:00Z',
      }),
    ).rejects.toMatchObject({ code: 'AVAILABILITY_CONFLICT' });
  });

  it('reproduces the CTF live request and accepts after quiet-environment support is confirmed', async () => {
    const core = platform().core;
    const request = await core.createRequest(t.participant, {
      ...ama,
      title: 'How to start with CTFs?',
      topic_tags: ['cybersecurity', 'python', 'portfolio'],
      preferred_mode: 'live_online',
      access_preferences: [
        'simple_language',
        'written_instructions',
        'step_by_step_explanation',
        'quiet_environment',
      ],
      availability_windows: [
        { start: '2030-01-08T02:00:00Z', end: '2030-01-08T03:00:00Z' },
      ],
    });
    const notice = (await core.listNotifications(t.volunteer)).find(
      (n) => n.request_id === request.id,
    )!;
    expect(notice).toBeDefined();
    const before = (await core.listMatches(t.volunteer, request.id))[0]!;
    expect(before.booking.missing_access_preferences).toEqual([
      'quiet_environment',
    ]);
    expect(before.booking.ready).toBe(false);
    const profile = (await t.db.get('volunteer_profiles', t.volunteer.id))!;
    await core.updateProfile(t.volunteer, t.volunteer.id, {
      supported_access_preferences: [
        ...profile.supported_access_preferences,
        'quiet_environment',
      ],
    });
    const after = (await core.listMatches(t.volunteer, request.id))[0]!;
    expect(after.booking.ready).toBe(true);
    const start = after.suggested_windows[0]!.start;
    const response = await core.updateMatch(t.volunteer, after.id, {
      status: 'accepted',
      mode: 'live_online',
      scheduled_start: start,
      scheduled_end: new Date(
        Date.parse(start) + request.duration_minutes * 60000,
      ).toISOString(),
    });
    expect(response.engagement?.status).toBe('confirmed');
  });

  it('repairs existing requests without duplicating notifications or reopening declines and bookings', async () => {
    const { core, matching } = platform();
    const legacy = await t.core.createRequest(t.participant, {
      ...ama,
      access_preferences: ['quiet_environment'],
    });
    expect(await core.listNotifications(t.volunteer)).toEqual([]);
    expect(await matching.repairNotifications()).toBeGreaterThan(0);
    const notice = (await core.listNotifications(t.volunteer)).find(
      (n) => n.request_id === legacy.id,
    )!;
    expect(notice).toBeDefined();
    expect((await t.core.getRequest(legacy.id)).status).toBe('matched');
    await core.readNotification(t.volunteer, notice.id, { read: true });
    expect(await matching.repairNotifications()).toBe(0);
    expect(
      (await core.listNotifications(t.volunteer)).find(
        (n) => n.id === notice.id,
      )?.read_at,
    ).not.toBeNull();
    await core.updateMatch(t.volunteer, notice.match_id, {
      status: 'declined',
    });
    expect(await matching.repairNotifications()).toBe(0);
    expect(
      (await core.listNotifications(t.volunteer)).some(
        (n) => n.request_id === legacy.id,
      ),
    ).toBe(false);
    const fresh = await core.createRequest(t.participant, ama);
    const freshNotice = (await core.listNotifications(t.volunteer)).find(
      (n) => n.request_id === fresh.id,
    )!;
    await core.updateMatch(t.volunteer, freshNotice.match_id, {
      status: 'accepted',
    });
    await matching.repairNotifications();
    expect(
      (await core.listNotifications(t.volunteer)).some(
        (n) => n.request_id === fresh.id,
      ),
    ).toBe(false);
    expect(
      await t.db.list('engagements', { request_id: fresh.id }),
    ).toHaveLength(1);
  });

  it('keeps topic notifications when manually refreshing a blocked request', async () => {
    const { core, matching } = platform();
    const request = await core.createRequest(t.participant, {
      ...ama,
      access_preferences: ['quiet_environment'],
    });
    const notice = (await core.listNotifications(t.volunteer))[0]!;
    await matching.generateMatches(t.participant, request.id);
    expect((await core.listNotifications(t.volunteer))[0]!.id).toBe(notice.id);
    expect((await core.getRequest(request.id)).status).toBe('matched');
    expect(
      (await core.listMatches(t.volunteer, request.id)).some(
        (m) => m.status === 'suggested',
      ),
    ).toBe(true);
  });

  it('rejects invalid input without creating a request, match, or notification', async () => {
    const before = (await t.db.list('service_requests')).length;
    const invalid = [
      { topic_tags: undefined },
      { topic_tags: [] },
      { topic_tags: ['   '] },
      { topic_tags: ['Others'] },
      { topic_tags: ['<script>alert(1)</script>'] },
      { topic_tags: ['x'.repeat(81)] },
      { topic_tags: Array.from({ length: 31 }, (_, i) => `topic ${i}`) },
      { industry_tags: ['Others'] },
      { details: '   ' },
      { duration_minutes: 60 },
      { deadline: '2029-12-31T00:00:00Z' },
      {
        ...teaching,
        availability_windows: [
          { start: '2029-12-31T00:00:00Z', end: '2029-12-31T01:00:00Z' },
        ],
      },
    ];
    for (const patch of invalid) {
      const response = await api().inject({
        method: 'POST',
        url: '/api/requests',
        headers: headers(t.participant.id),
        payload: { ...ama, ...patch },
      });
      expect(response.statusCode).toBeGreaterThanOrEqual(400);
      expect(response.statusCode).toBeLessThan(500);
    }
    expect(await t.db.list('service_requests')).toHaveLength(before);
    expect(await t.db.list('matches')).toEqual([]);
    expect(await t.db.list('notifications')).toEqual([]);
  });

  it('rolls back the entire creation when notification persistence fails', async () => {
    const before = (await t.db.list('service_requests')).length;
    const { core } = createPlatform(
      {
        ...t.db,
        transaction: (work) =>
          t.db.transaction((repo) =>
            work({
              ...repo,
              insert: async (table, row) => {
                if (table === 'notifications')
                  throw new Error('Notification storage unavailable');
                return repo.insert(table, row);
              },
            }),
          ),
      },
      { now: () => t.now },
    );
    await expect(core.createRequest(t.participant, ama)).rejects.toThrow(
      'Notification storage unavailable',
    );
    expect(await t.db.list('service_requests')).toHaveLength(before);
    expect(await t.db.list('matches')).toEqual([]);
    expect(await t.db.list('notifications')).toEqual([]);
  });
});
