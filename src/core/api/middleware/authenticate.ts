import type { FastifyInstance, FastifyRequest } from 'fastify';
import type { AuthAdapter } from '../../auth/auth-adapter.js';
import type { User } from '../../domain/entities.js';
import { fail } from '../../domain/errors.js';
declare module 'fastify' {
  interface FastifyRequest {
    actor: User | null;
  }
}
export function attachAuthentication(
  app: FastifyInstance,
  auth: AuthAdapter,
): void {
  app.decorateRequest('actor', null);
  app.addHook('preHandler', async (request) => {
    request.actor = await auth.authenticate(request.headers);
  });
}
export function actor(request: FastifyRequest): User {
  if (!request.actor)
    fail('UNAUTHENTICATED', 'Authentication is required', 401);
  return request.actor;
}
