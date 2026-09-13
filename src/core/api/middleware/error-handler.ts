import type { FastifyInstance } from 'fastify';
import { ZodError } from 'zod';
import { DomainError } from '../../domain/errors.js';
import { failure } from '../responses.js';
export function attachErrorHandler(app: FastifyInstance): void {
  app.setErrorHandler(
    (error: Error & { code?: string; statusCode?: number }, request, reply) => {
      if (error instanceof DomainError)
        return reply
          .code(error.status)
          .send(failure(error.code, error.message));
      if (error instanceof ZodError)
        return reply
          .code(400)
          .send(
            failure(
              'VALIDATION_ERROR',
              error.issues
                .map((i) => `${i.path.join('.') || 'input'}: ${i.message}`)
                .join('; '),
            ),
          );
      if (error.code === '23505')
        return reply
          .code(409)
          .send(
            failure(
              'DUPLICATE_RESOURCE',
              'This booking, match, or feedback already exists',
            ),
          );
      if (error.code === '23514' || error.code === '23503')
        return reply
          .code(409)
          .send(
            failure(
              'CONSTRAINT_VIOLATION',
              'The change conflicts with a database rule or related resource',
            ),
          );
      if (error.statusCode && error.statusCode >= 400 && error.statusCode < 500)
        return reply
          .code(error.statusCode)
          .send(
            failure(
              'VALIDATION_ERROR',
              'Invalid JSON, content type, or request size',
            ),
          );
      request.log.error(
        { code: error.code, name: error.name },
        'Request failed',
      );
      return reply
        .code(500)
        .send(failure('INTERNAL_ERROR', 'An unexpected server error occurred'));
    },
  );
  app.setNotFoundHandler((_request, reply) =>
    reply.code(404).send(failure('NOT_FOUND', 'Endpoint not found')),
  );
}
