import type { FastifyInstance } from 'fastify';
import type { Core } from '../../index.js';
import { actor } from '../middleware/authenticate.js';
import { routeId } from '../middleware/validate.js';
import { success } from '../responses.js';
export function offerRoutes(app: FastifyInstance, core: Core): void {
  app.post('/api/offers', async (request, reply) =>
    reply
      .code(201)
      .send(success(await core.createOffer(actor(request), request.body))),
  );
  app.get('/api/offers', async (request) =>
    success(await core.listOffers(actor(request))),
  );
  app.get('/api/offers/:id', async (request) =>
    success(await core.getOffer(actor(request), routeId(request.params))),
  );
  app.patch('/api/offers/:id', async (request) =>
    success(
      await core.updateOffer(
        actor(request),
        routeId(request.params),
        request.body,
      ),
    ),
  );
}
