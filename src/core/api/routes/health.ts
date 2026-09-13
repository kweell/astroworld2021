import type { FastifyInstance } from 'fastify';
import { success } from '../responses.js';
export function healthRoutes(app: FastifyInstance): void {
  app.get('/api/health', async () =>
    success({ status: 'ok', timezone: 'Asia/Singapore' }),
  );
}
