import type { User } from '../domain/entities.js';
import { fail, requireFound } from '../domain/errors.js';
import { assertTransition } from '../domain/lifecycle.js';
import { isOperator, requireOwner, requireRole } from '../auth/permissions.js';
import { offerPatchSchema, offerSchema } from '../validation/offers.js';
import type { Context } from './context.js';
import { timestamps } from './context.js';
import {
  assertNoConflict,
  assertVolunteer,
  assertWeeklyCapacity,
} from './booking-rules.js';
import { transitionEngagement } from './engagements.js';
export function offerServices(ctx: Context) {
  return {
    async createOffer(actor: User, input: unknown) {
      requireRole(actor, 'volunteer');
      const data = offerSchema.parse(input);
      return ctx.db.transaction(async (repo) => {
        const profile = requireFound(
          await repo.get('volunteer_profiles', actor.id),
          'Volunteer profile',
        );
        assertVolunteer(profile, 'career_story', data.mode);
        if (data.status === 'open') {
          if (Date.parse(data.starts_at) <= ctx.now().getTime())
            fail('SCHEDULE_PASSED', 'Offers must start in the future');
          await assertWeeklyCapacity(repo, profile, data.starts_at, 15);
          await assertNoConflict(repo, actor.id, {
            start: data.starts_at,
            end: data.ends_at,
          });
        }
        return repo.insert('volunteer_offers', {
          ...data,
          id: ctx.id(),
          volunteer_id: actor.id,
          total_capacity: data.capacity,
          ...timestamps(ctx),
        });
      });
    },
    async listOffers(actor: User) {
      return (await ctx.db.list('volunteer_offers')).filter(
        (o) =>
          isOperator(actor) ||
          o.volunteer_id === actor.id ||
          (['open', 'full'].includes(o.status) &&
            Date.parse(o.ends_at) > ctx.now().getTime()),
      );
    },
    async getOffer(actor: User, id: string) {
      const offer = requireFound(
        await ctx.db.get('volunteer_offers', id),
        'Offer',
      );
      if (
        offer.status === 'draft' &&
        offer.volunteer_id !== actor.id &&
        !isOperator(actor)
      )
        fail('FORBIDDEN', 'Draft offers are private', 403);
      return offer;
    },
    async updateOffer(actor: User, id: string, input: unknown) {
      const patch = offerPatchSchema.parse(input);
      return ctx.db.transaction(async (repo) => {
        const offer = requireFound(
          await repo.get('volunteer_offers', id),
          'Offer',
        );
        requireOwner(actor, offer.volunteer_id);
        if (['completed', 'cancelled'].includes(offer.status))
          fail('INVALID_TRANSITION', 'This offer is already closed');
        const { status, ...edits } = patch;
        if (status && Object.keys(edits).length)
          fail(
            'VALIDATION_ERROR',
            'Change status separately from offer details',
            400,
          );
        const engagements = await repo.list('engagements', { offer_id: id });
        if (status) {
          assertTransition('offer', offer.status, status);
          if (status === 'open') {
            // Only draft publication is externally allowed; cancellation restores full offers automatically.
            if (offer.status !== 'draft')
              fail(
                'INVALID_TRANSITION',
                'Seat availability is managed through bookings',
              );
            const profile = requireFound(
              await repo.get('volunteer_profiles', offer.volunteer_id),
              'Volunteer profile',
            );
            assertVolunteer(profile, 'career_story', offer.mode);
            if (Date.parse(offer.starts_at) <= ctx.now().getTime())
              fail('SCHEDULE_PASSED', 'Offers must start in the future');
            await assertWeeklyCapacity(
              repo,
              profile,
              offer.starts_at,
              15,
              offer.id,
            );
            await assertNoConflict(
              repo,
              offer.volunteer_id,
              { start: offer.starts_at, end: offer.ends_at },
              offer.id,
            );
          } else {
            if (
              status === 'completed' &&
              Date.parse(offer.ends_at) > ctx.now().getTime()
            )
              fail(
                'SESSION_NOT_ENDED',
                'Complete an offer after its scheduled end',
              );
            for (const engagement of engagements.filter(
              (e) => e.status === 'confirmed',
            ))
              await transitionEngagement(ctx, repo, engagement, status);
          }
          return repo.update('volunteer_offers', id, { status });
        }
        if (engagements.some((e) => e.status !== 'cancelled'))
          fail(
            'OFFER_HAS_BOOKINGS',
            'Offer details cannot change while seats are booked',
          );
        const data = offerSchema.parse({
          service_type: offer.service_type,
          title: offer.title,
          description: offer.description,
          industry_tags: offer.industry_tags,
          topic_tags: offer.topic_tags,
          mode: offer.mode,
          starts_at: offer.starts_at,
          ends_at: offer.ends_at,
          capacity: offer.total_capacity,
          access_features: offer.access_features,
          status: offer.status,
          ...edits,
        });
        if (offer.status === 'open') {
          const profile = requireFound(
            await repo.get('volunteer_profiles', offer.volunteer_id),
            'Volunteer profile',
          );
          assertVolunteer(profile, 'career_story', data.mode);
          if (Date.parse(data.starts_at) <= ctx.now().getTime())
            fail('SCHEDULE_PASSED', 'Offers must start in the future');
          await assertWeeklyCapacity(
            repo,
            profile,
            data.starts_at,
            15,
            offer.id,
          );
          await assertNoConflict(
            repo,
            offer.volunteer_id,
            { start: data.starts_at, end: data.ends_at },
            offer.id,
          );
        }
        return repo.update('volunteer_offers', id, {
          ...data,
          total_capacity: data.capacity,
        });
      });
    },
  };
}
