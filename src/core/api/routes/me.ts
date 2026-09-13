import type { FastifyInstance } from 'fastify';
import type { Core } from '../../index.js';
import { actor } from '../middleware/authenticate.js';
import { success } from '../responses.js';
export function meRoutes(app: FastifyInstance, core: Core): void {
  app.get('/api/me', async (request) =>
    success(await core.getProfile(actor(request), actor(request).id)),
  );
}
