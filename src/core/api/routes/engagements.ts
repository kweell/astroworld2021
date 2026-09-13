import type { FastifyInstance } from 'fastify';
import type { Core } from '../../index.js';
import { actor } from '../middleware/authenticate.js';
import { routeId } from '../middleware/validate.js';
import { success } from '../responses.js';
export function engagementRoutes(app: FastifyInstance, core: Core): void {
  app.post('/api/engagements', async (request, reply) =>
    reply
      .code(201)
      .send(success(await core.createEngagement(actor(request), request.body))),
  );
  app.get('/api/engagements/:id', async (request) =>
    success(await core.getEngagement(actor(request), routeId(request.params))),
  );
  app.patch('/api/engagements/:id', async (request) =>
    success(
      await core.updateEngagement(
        actor(request),
        routeId(request.params),
        request.body,
      ),
    ),
  );
}
