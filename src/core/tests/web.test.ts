import { afterEach, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { createApp } from '../api/app.js';
import { registerWeb } from '../api/web.js';
import { demoAuth } from '../auth/demo-auth.js';
import type { Config } from '../config.js';
import { ama, resultFor, useTestDatabase } from './fixtures.js';

describe('web app API boundaries', () => {
  const t = useTestDatabase();
  let app: FastifyInstance | undefined;
  const config: Config = {
    NODE_ENV: 'test',
    DATABASE_MODE: 'local',
    LOCAL_DATABASE_PATH: ':memory:',
    DEMO_AUTH_MODE: true,
    HOST: '127.0.0.1',
    PORT: 3000,
    SUPABASE_URL: 'https://example.supabase.co',
    SUPABASE_SERVICE_ROLE_KEY: 'private-service-role-key',
    SUPABASE_DB_URL: 'postgresql://private-database-password',
    SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_example',
  };
  const api = (overrides: Partial<Config> = {}) => {
    app = createApp(t.core, demoAuth(t.db, true, 'test'));
    registerWeb(app, t.db, { ...config, ...overrides });
    return app;
  };
  afterEach(async () => {
    await app?.close();
    app = undefined;
  });
  it('lists only seeded demo identities and never sends server credentials', async () => {
    const response = await api().inject('/api/ui-config');
    expect(response.statusCode).toBe(200);
    expect(response.headers['cache-control']).toBe('no-store');
    const result = response.json().data;
    expect(result.identities).toHaveLength(14);
    expect(
      result.identities.every((user: { role: string }) =>
        ['participant', 'volunteer'].includes(user.role),
      ),
    ).toBe(true);
    expect(Object.keys(result.identities[0]).sort()).toEqual([
      'display_name',
      'id',
      'role',
    ]);
    expect(result.supabasePublishableKey).toBeNull();
    expect(response.body).not.toContain('private-');
  });
  it('disables demo identity discovery for real authentication', async () => {
    const response = await api({ DEMO_AUTH_MODE: false }).inject(
      '/api/ui-config',
    );
    expect(response.json().data).toEqual({
      demo: false,
      identities: [],
      supabaseUrl: 'https://example.supabase.co',
      supabasePublishableKey: 'sb_publishable_example',
    });
    expect(response.body).not.toContain('private-');
  });
  it('keeps session lists private and marks only the caller’s own feedback', async () => {
    const request = await t.core.createRequest(t.participant, ama);
    const [match] = await t.core.saveMatches(request.id, [
      resultFor(t.volunteer.id),
    ]);
    const booking = await t.core.createEngagement(t.volunteer, {
      match_id: match!.id,
    });
    await t.core.updateEngagement(t.participant, booking.id, {
      status: 'completed',
    });
    await t.core.createFeedback(t.participant, {
      engagement_id: booking.id,
      helpful: true,
    });
    const server = api();
    const list = (id?: string) =>
      server.inject({
        method: 'GET',
        url: '/api/engagements',
        headers: id ? { 'x-demo-user-id': id } : {},
      });
    expect((await list()).statusCode).toBe(401);
    expect((await list(t.otherParticipant.id)).json().data).toEqual([]);
    expect((await list(t.participant.id)).json().data).toEqual([
      expect.objectContaining({ id: booking.id, feedback_submitted: true }),
    ]);
    expect((await list(t.volunteer.id)).json().data).toEqual([
      expect.objectContaining({ id: booking.id, feedback_submitted: false }),
    ]);
    expect((await list(t.admin.id)).json().data).toHaveLength(1);
  });
});
