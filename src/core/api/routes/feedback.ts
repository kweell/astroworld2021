import type { FastifyInstance } from 'fastify';
import type { Core } from '../../index.js';
import { actor } from '../middleware/authenticate.js';
import { success } from '../responses.js';
export function feedbackRoutes(app: FastifyInstance, core: Core): void {
  app.post('/api/feedback', async (request, reply) =>
    reply
      .code(201)
      .send(success(await core.createFeedback(actor(request), request.body))),
  );
}
