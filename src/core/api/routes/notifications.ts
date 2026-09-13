import type { FastifyInstance } from 'fastify';
import type { Core } from '../../index.js';
import { actor } from '../middleware/authenticate.js';
import { routeId } from '../middleware/validate.js';
import { success } from '../responses.js';
export function notificationRoutes(app: FastifyInstance, core: Core) {
  app.get('/api/notifications', async (request, reply) => {
    reply.header('Cache-Control', 'no-store');
    return success(await core.listNotifications(actor(request)));
  });
  app.patch('/api/notifications/:id', async (request) =>
    success(
      await core.readNotification(
        actor(request),
        routeId(request.params),
        request.body,
      ),
    ),
  );
}
