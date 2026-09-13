import type { FastifyInstance } from 'fastify';
import type { Core } from '../../index.js';
import { actor } from '../middleware/authenticate.js';
import { routeId } from '../middleware/validate.js';
import { success } from '../responses.js';
export function requestRoutes(app: FastifyInstance, core: Core): void {
  app.post('/api/requests', async (request, reply) =>
    reply
      .code(201)
      .send(success(await core.createRequest(actor(request), request.body))),
  );
  app.get('/api/requests', async (request) =>
    success(await core.listRequests(actor(request), request.query)),
  );
  app.get('/api/requests/:id', async (request) =>
    success(await core.getRequest(routeId(request.params), actor(request))),
  );
  app.patch('/api/requests/:id', async (request) =>
    success(
      await core.updateRequest(
        actor(request),
        routeId(request.params),
        request.body,
      ),
    ),
  );
}
