import type { FastifyInstance } from 'fastify';
import { actor } from '../core/api/middleware/authenticate.js';
import { routeId } from '../core/api/middleware/validate.js';
import { success } from '../core/api/responses.js';
import type { MatchingIntegration } from './generate-matches.js';

// Registered inside the core API's authenticated scope at the composition root.
export function registerMatchingRoutes(
  app: FastifyInstance,
  matching: MatchingIntegration,
): void {
  app.post('/api/requests/:id/matches/generate', async (request, reply) =>
    reply
      .code(201)
      .send(
        success(
          await matching.generateMatches(
            actor(request),
            routeId(request.params),
            request.body ?? {},
          ),
        ),
      ),
  );
  app.post('/api/offers/rank', async (request) =>
    success(await matching.rankOffers(actor(request), request.body ?? {})),
  );
}
