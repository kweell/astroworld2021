import Fastify, { type FastifyInstance } from 'fastify';
import type { AuthAdapter } from '../auth/auth-adapter.js';
import type { Core } from '../index.js';
import { attachAuthentication } from './middleware/authenticate.js';
import { attachErrorHandler } from './middleware/error-handler.js';
import { healthRoutes } from './routes/health.js';
import { meRoutes } from './routes/me.js';
import { profileRoutes } from './routes/profiles.js';
import { requestRoutes } from './routes/requests.js';
import { offerRoutes } from './routes/offers.js';
import { matchRoutes } from './routes/matches.js';
import { engagementRoutes } from './routes/engagements.js';
import { feedbackRoutes } from './routes/feedback.js';
import { notificationRoutes } from './routes/notifications.js';
export function createApp(
  core: Core,
  auth: AuthAdapter,
  registerIntegration?: (app: FastifyInstance) => void,
) {
  const app = Fastify({ bodyLimit: 65536, logger: false });
  attachErrorHandler(app);
  healthRoutes(app);
  app.register(async (authenticated) => {
    attachAuthentication(authenticated, auth);
    meRoutes(authenticated, core);
    profileRoutes(authenticated, core);
    requestRoutes(authenticated, core);
    offerRoutes(authenticated, core);
    matchRoutes(authenticated, core);
    engagementRoutes(authenticated, core);
    feedbackRoutes(authenticated, core);
    notificationRoutes(authenticated, core);
    registerIntegration?.(authenticated);
  });
  return app;
}
