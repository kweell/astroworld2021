import type { User } from '../domain/entities.js';
import { fail, requireFound } from '../domain/errors.js';
import { assertTransition } from '../domain/lifecycle.js';
import { isOperator, requireOwner, requireRole } from '../auth/permissions.js';
import type { Repository } from '../repositories/interfaces.js';
import {
  requestPatchSchema,
  requestQuerySchema,
  requestSchema,
} from '../validation/requests.js';
import type { Context } from './context.js';
import { timestamps } from './context.js';
export async function expireSuggested(
  repo: Repository,
  requestId: string,
): Promise<void> {
  for (const match of await repo.list('matches', {
    request_id: requestId,
    status: 'suggested',
  }))
    await repo.update('matches', match.id, { status: 'expired' });
}
export async function canReadRequest(
  repo: Repository,
  actor: User,
  requestId: string,
): Promise<void> {
  const request = requireFound(
    await repo.get('service_requests', requestId),
    'Request',
  );
  if (request.participant_id === actor.id || isOperator(actor)) return;
  if (
    (
      await repo.list('matches', {
        request_id: requestId,
        volunteer_id: actor.id,
      })
    ).some((m) => ['suggested', 'accepted'].includes(m.status)) &&
    request.status !== 'cancelled'
  )
    return;
  fail(
    'FORBIDDEN',
    'This request is private to its participant and assigned volunteers',
    403,
  );
}
export function requestServices(ctx: Context) {
  return {
    async createRequest(actor: User, input: unknown) {
      requireRole(actor, 'participant');
      const data = requestSchema.parse(input);
      return ctx.db.transaction((repo) =>
        repo.insert('service_requests', {
          ...data,
          id: ctx.id(),
          participant_id: actor.id,
          status: 'open',
          ...timestamps(ctx),
        }),
      );
    },
    // Omitting actor is for trusted server-side integration only.
    async getRequest(id: string, actor?: User) {
      if (actor) await canReadRequest(ctx.db, actor, id);
      return requireFound(await ctx.db.get('service_requests', id), 'Request');
    },
    async listRequests(actor: User, input: unknown) {
      const query = requestQuerySchema.parse(input);
      if (
        query.participantId &&
        query.participantId !== actor.id &&
        !isOperator(actor)
      )
        fail('FORBIDDEN', 'Cannot list another participant’s requests', 403);
      const ownMatches =
        actor.role === 'volunteer'
          ? await ctx.db.list('matches', { volunteer_id: actor.id })
          : [];
      return (await ctx.db.list('service_requests')).filter(
        (r) =>
          (isOperator(actor) ||
            r.participant_id === actor.id ||
            (r.status !== 'cancelled' &&
              ownMatches.some(
                (m) =>
                  m.request_id === r.id &&
                  ['suggested', 'accepted'].includes(m.status),
              ))) &&
          (!query.participantId || query.participantId === r.participant_id) &&
          (!query.status || query.status === r.status) &&
          (!query.serviceType || query.serviceType === r.service_type),
      );
    },
    async updateRequest(actor: User, id: string, input: unknown) {
      const patch = requestPatchSchema.parse(input);
      return ctx.db.transaction(async (repo) => {
        const request = requireFound(
          await repo.get('service_requests', id),
          'Request',
        );
        requireOwner(actor, request.participant_id);
        if (!['open', 'matched'].includes(request.status))
          fail(
            'INVALID_TRANSITION',
            'Only open or matched requests can be edited; manage accepted requests through their engagement',
          );
        const {
          id: _,
          participant_id: _p,
          status: _s,
          created_at: _c,
          updated_at: _u,
          ...fields
        } = request;
        const { status, ...edits } = patch;
        if (status && Object.keys(edits).length)
          fail(
            'VALIDATION_ERROR',
            'Cancel separately from editing request details',
            400,
          );
        const data = requestSchema.parse({ ...fields, ...edits });
        const nextStatus = status ?? 'open';
        if (request.status !== nextStatus)
          assertTransition('request', request.status, nextStatus);
        await expireSuggested(repo, id);
        return repo.update('service_requests', id, {
          ...data,
          status: nextStatus,
        });
      });
    },
  };
}
