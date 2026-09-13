import type { FastifyInstance } from 'fastify';
import type { Core } from '../../index.js';
import { actor } from '../middleware/authenticate.js';
import { routeId } from '../middleware/validate.js';
import { success } from '../responses.js';
export function profileRoutes(app: FastifyInstance, core: Core): void {
  app.get('/api/profiles/:userId', async (request) =>
    success(
      await core.getProfile(actor(request), routeId(request.params, 'userId')),
    ),
  );
  app.patch('/api/profiles/:userId', async (request) =>
    success(
      await core.updateProfile(
        actor(request),
        routeId(request.params, 'userId'),
        request.body,
      ),
    ),
  );
}
