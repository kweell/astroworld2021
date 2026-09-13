import type { User } from '../domain/entities.js';
import { fail, requireFound } from '../domain/errors.js';
import { feedbackSchema } from '../validation/feedback.js';
import type { Context } from './context.js';
import { isEngagementMember } from './booking-rules.js';
export function feedbackServices(ctx: Context) {
  return {
    async createFeedback(actor: User, input: unknown) {
      const data = feedbackSchema.parse(input);
      return ctx.db.transaction(async (repo) => {
        const engagement = requireFound(
          await repo.get('engagements', data.engagement_id),
          'Engagement',
        );
        if (!isEngagementMember(actor.id, engagement))
          fail('FORBIDDEN', 'Only engagement members can submit feedback', 403);
        if (engagement.status !== 'completed')
          fail(
            'ENGAGEMENT_NOT_COMPLETED',
            'Feedback requires a completed engagement',
          );
        if (
          (
            await repo.list('feedback', {
              engagement_id: data.engagement_id,
              submitted_by: actor.id,
            })
          ).length
        )
          fail('DUPLICATE_FEEDBACK', 'Feedback has already been submitted');
        return repo.insert('feedback', {
          ...data,
          id: ctx.id(),
          submitted_by: actor.id,
          created_at: ctx.now().toISOString(),
        });
      });
    },
  };
}
