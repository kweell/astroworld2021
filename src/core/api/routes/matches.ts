import type { FastifyInstance } from 'fastify';
import type { Core } from '../../index.js';
import { actor } from '../middleware/authenticate.js';
import { routeId } from '../middleware/validate.js';
import { success } from '../responses.js';
export function matchRoutes(app: FastifyInstance, core: Core): void {
  app.post('/api/matches', async (request, reply) =>
    reply
      .code(201)
      .send(success(await core.createMatches(actor(request), request.body))),
  );
  app.get('/api/requests/:id/matches', async (request) =>
    success(await core.listMatches(actor(request), routeId(request.params))),
  );
  app.patch('/api/matches/:id', async (request) =>
    success(
      await core.updateMatch(
        actor(request),
        routeId(request.params),
        request.body,
      ),
    ),
  );
}
