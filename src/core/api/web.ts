import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import staticFiles from '@fastify/static';
import type { FastifyInstance } from 'fastify';
import type { Config } from '../config.js';
import type { Database } from '../repositories/interfaces.js';
import { demoIds } from '../seed/data.js';
import { success } from './responses.js';

export function registerWeb(
  app: FastifyInstance,
  db: Database,
  config: Config,
) {
  app.get('/api/ui-config', async (_request, reply) => {
    reply.header('Cache-Control', 'no-store');
    const ids = [...demoIds.participants, ...demoIds.volunteers];
    const identities = config.DEMO_AUTH_MODE
      ? (await db.list('users'))
          .filter((user) => ids.includes(user.id))
          .map(({ id, display_name, role }) => ({ id, display_name, role }))
      : [];
    return success({
      demo: config.DEMO_AUTH_MODE,
      identities,
      supabaseUrl: config.DEMO_AUTH_MODE ? null : (config.SUPABASE_URL ?? null),
      // Only a dedicated public client key is ever sent to the browser.
      supabasePublishableKey: config.DEMO_AUTH_MODE
        ? null
        : (config.SUPABASE_PUBLISHABLE_KEY ?? null),
    });
  });
  const root = resolve('dist/web');
  if (existsSync(resolve(root, 'index.html'))) {
    app.register(staticFiles, { root });
  }
}
