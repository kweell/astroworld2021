import type { User } from '../domain/entities.js';
import { fail, requireFound } from '../domain/errors.js';
import { assertTransition } from '../domain/lifecycle.js';
import { isOperator, requireRole } from '../auth/permissions.js';
import { matchPatchSchema, saveMatchesSchema } from '../validation/matches.js';
import type { Context } from './context.js';
import { acceptMatch } from './engagements.js';
import { canReadRequest, expireSuggested } from './requests.js';
import { overlappingTopics } from '../domain/interests.js';
export function matchServices(ctx: Context) {
  return {
    // Trusted integration entry point. Scores/reasons are persisted, never computed here.
    async saveMatches(requestId: string, results: unknown) {
      const data = saveMatchesSchema.parse({ request_id: requestId, results });
      return ctx.db.transaction(async (repo) => {
        const request = requireFound(
          await repo.get('service_requests', requestId),
          'Request',
        );
        if (!['open', 'matched'].includes(request.status))
          fail(
            'INVALID_TRANSITION',
            'Matches can only be generated for open or matched requests',
          );
        for (const result of data.results)
          requireFound(
            await repo.get('volunteer_profiles', result.volunteerId),
            'Volunteer profile',
          );
        await expireSuggested(repo, requestId);
        const matches = [];
        for (const result of data.results) {
          const match = await repo.insert('matches', {
            id: ctx.id(),
            request_id: requestId,
            volunteer_id: result.volunteerId,
            score: result.score,
            reasons: result.reasons,
            suggested_windows: result.compatibleWindows,
            status: 'suggested',
            created_at: ctx.now().toISOString(),
          });
          matches.push(match);
          const volunteer = requireFound(
            await repo.get('volunteer_profiles', result.volunteerId),
            'Volunteer profile',
          );
          if (
            volunteer.verification_status === 'verified' &&
            overlappingTopics(request.topic_tags, volunteer.expertise_tags)
              .length
          ) {
            const existing = (
              await repo.list('notifications', {
                recipient_id: result.volunteerId,
                request_id: requestId,
              })
            )[0];
            if (existing)
              await repo.update('notifications', existing.id, {
                match_id: match.id,
              });
            else
              await repo.insert('notifications', {
                id: ctx.id(),
                recipient_id: result.volunteerId,
                request_id: requestId,
                match_id: match.id,
                created_at: ctx.now().toISOString(),
                read_at: null,
              });
          }
        }
        await repo.update('service_requests', requestId, {
          status: matches.length ? 'matched' : 'open',
        });
        return matches;
      });
    },
    async listMatches(actor: User, requestId: string) {
      await canReadRequest(ctx.db, actor, requestId);
      return (await ctx.db.list('matches', { request_id: requestId })).filter(
        (m) => actor.role !== 'volunteer' || m.volunteer_id === actor.id,
      );
    },
    async updateMatch(actor: User, id: string, input: unknown) {
      const data = matchPatchSchema.parse(input);
      return ctx.db.transaction(async (repo) => {
        const match = requireFound(await repo.get('matches', id), 'Match');
        if (data.status === 'accepted')
          return {
            match: { ...match, status: 'accepted' as const },
            engagement: await acceptMatch(ctx, repo, actor, id, data),
          };
        if (data.status === 'expired')
          requireRole(actor, 'admin', 'facilitator');
        else if (actor.role !== 'volunteer' || match.volunteer_id !== actor.id)
          fail('FORBIDDEN', 'Only the suggested volunteer may decline', 403);
        assertTransition('match', match.status, data.status);
        const updated = await repo.update('matches', id, {
          status: data.status,
        });
        const request = requireFound(
          await repo.get('service_requests', match.request_id),
          'Request',
        );
        if (
          request.status === 'matched' &&
          !(
            await repo.list('matches', {
              request_id: request.id,
              status: 'suggested',
            })
          ).length
        )
          await repo.update('service_requests', request.id, { status: 'open' });
        return { match: updated, engagement: null };
      });
    },
    async createMatches(actor: User, input: unknown) {
      if (!isOperator(actor))
        fail(
          'FORBIDDEN',
          'Only trusted operators may submit matching results',
          403,
        );
      const data = saveMatchesSchema.parse(input);
      return this.saveMatches(data.request_id, data.results);
    },
  };
}
