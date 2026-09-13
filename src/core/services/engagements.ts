import type { Engagement, User } from '../domain/entities.js';
import { fail, requireFound } from '../domain/errors.js';
import { assertTransition } from '../domain/lifecycle.js';
import type { ResolvedMode } from '../domain/types.js';
import { isOperator, requireRole } from '../auth/permissions.js';
import type { Repository } from '../repositories/interfaces.js';
import {
  engagementPatchSchema,
  engagementSchema,
} from '../validation/engagements.js';
import {
  assertNoConflict,
  assertVolunteer,
  assertWeeklyCapacity,
  contains,
  isEngagementMember,
} from './booking-rules.js';
import type { Context } from './context.js';
import { timestamps } from './context.js';
import { expireSuggested } from './requests.js';
export interface BookingInput {
  mode?: ResolvedMode;
  scheduled_start?: string;
  scheduled_end?: string;
}
export async function acceptMatch(
  ctx: Context,
  repo: Repository,
  actor: User,
  matchId: string,
  booking: BookingInput,
) {
  requireRole(actor, 'volunteer');
  const match = requireFound(await repo.get('matches', matchId), 'Match');
  if (match.volunteer_id !== actor.id)
    fail('FORBIDDEN', 'Only the suggested volunteer may accept', 403);
  assertTransition('match', match.status, 'accepted');
  const request = requireFound(
    await repo.get('service_requests', match.request_id),
    'Request',
  );
  assertTransition('request', request.status, 'accepted');
  const volunteer = requireFound(
    await repo.get('volunteer_profiles', actor.id),
    'Volunteer profile',
  );
  if (request.preferred_mode === 'either' && !booking.mode)
    fail(
      'VALIDATION_ERROR',
      'Resolve either to an explicit mode when accepting',
      400,
    );
  const mode = booking.mode ?? (request.preferred_mode as ResolvedMode);
  if (request.preferred_mode !== 'either' && mode !== request.preferred_mode)
    fail('UNSUPPORTED_MODE', 'Booking mode must match the request');
  assertVolunteer(volunteer, request.service_type, mode);
  if (
    request.access_preferences.some(
      (p) => !volunteer.supported_access_preferences.includes(p),
    )
  )
    fail(
      'ACCESS_UNSUPPORTED',
      'Volunteer cannot support all declared access preferences',
    );
  if (request.deadline && Date.parse(request.deadline) <= ctx.now().getTime())
    fail('DEADLINE_PASSED', 'The request deadline has passed');
  const start = booking.scheduled_start ?? null;
  const end = booking.scheduled_end ?? null;
  if (mode === 'async') {
    if (start || end)
      fail(
        'VALIDATION_ERROR',
        'Async engagements do not have a scheduled time',
        400,
      );
  } else {
    if (
      !start ||
      !end ||
      Date.parse(end) - Date.parse(start) !== request.duration_minutes * 60000
    )
      fail(
        'VALIDATION_ERROR',
        'Provide a live slot with exactly the requested duration',
        400,
      );
    if (Date.parse(start) <= ctx.now().getTime())
      fail('SCHEDULE_PASSED', 'The selected slot must be in the future');
    if (request.deadline && Date.parse(end) > Date.parse(request.deadline))
      fail('DEADLINE_EXCEEDED', 'The slot ends after the request deadline');
    if (
      !contains(request.availability_windows, start, end) ||
      !contains(volunteer.available_windows, start, end)
    )
      fail(
        'AVAILABILITY_CONFLICT',
        'The slot must be inside participant and volunteer availability',
      );
    await assertNoConflict(repo, actor.id, { start, end });
    await assertNoConflict(repo, request.participant_id, { start, end });
  }
  await assertWeeklyCapacity(
    repo,
    volunteer,
    start ?? ctx.now().toISOString(),
    request.duration_minutes,
  );
  await repo.update('matches', match.id, { status: 'accepted' });
  await expireSuggested(repo, request.id);
  await repo.update('service_requests', request.id, { status: 'accepted' });
  return repo.insert('engagements', {
    id: ctx.id(),
    participant_id: request.participant_id,
    volunteer_id: actor.id,
    service_type: request.service_type,
    request_id: request.id,
    offer_id: null,
    scheduled_start: start,
    scheduled_end: end,
    duration_minutes: request.duration_minutes,
    mode,
    status: 'confirmed',
    ...timestamps(ctx),
  });
}
async function reserveOffer(
  ctx: Context,
  repo: Repository,
  actor: User,
  offerId: string,
) {
  requireRole(actor, 'participant');
  const offer = requireFound(
    await repo.get('volunteer_offers', offerId),
    'Offer',
  );
  if (offer.status === 'full' || offer.capacity === 0)
    fail('OFFER_FULL', 'There are no available seats');
  if (offer.status !== 'open')
    fail('INVALID_TRANSITION', 'Only open offers can be booked');
  if (Date.parse(offer.starts_at) <= ctx.now().getTime())
    fail('SCHEDULE_PASSED', 'The offer has already started');
  if (
    (
      await repo.list('engagements', {
        offer_id: offer.id,
        participant_id: actor.id,
      })
    ).some((e) => e.status !== 'cancelled')
  )
    fail('DUPLICATE_BOOKING', 'Participant already has a seat');
  const volunteer = requireFound(
    await repo.get('volunteer_profiles', offer.volunteer_id),
    'Volunteer profile',
  );
  assertVolunteer(volunteer, 'career_story', offer.mode);
  await assertWeeklyCapacity(repo, volunteer, offer.starts_at, 15, offer.id);
  await assertNoConflict(repo, actor.id, {
    start: offer.starts_at,
    end: offer.ends_at,
  });
  await assertNoConflict(
    repo,
    offer.volunteer_id,
    { start: offer.starts_at, end: offer.ends_at },
    offer.id,
  );
  await repo.update('volunteer_offers', offer.id, {
    capacity: offer.capacity - 1,
    status: offer.capacity === 1 ? 'full' : 'open',
  });
  return repo.insert('engagements', {
    id: ctx.id(),
    participant_id: actor.id,
    volunteer_id: offer.volunteer_id,
    service_type: 'career_story',
    request_id: null,
    offer_id: offer.id,
    scheduled_start: offer.starts_at,
    scheduled_end: offer.ends_at,
    duration_minutes: 15,
    mode: offer.mode,
    status: 'confirmed',
    ...timestamps(ctx),
  });
}
export async function transitionEngagement(
  ctx: Context,
  repo: Repository,
  engagement: Engagement,
  status: 'completed' | 'cancelled',
) {
  assertTransition('engagement', engagement.status, status);
  if (
    status === 'completed' &&
    engagement.scheduled_end &&
    Date.parse(engagement.scheduled_end) > ctx.now().getTime()
  )
    fail(
      'SESSION_NOT_ENDED',
      'A live engagement can be completed after its scheduled end',
    );
  const updated = await repo.update('engagements', engagement.id, { status });
  if (engagement.request_id)
    await repo.update('service_requests', engagement.request_id, { status });
  if (engagement.offer_id && status === 'cancelled') {
    const offer = requireFound(
      await repo.get('volunteer_offers', engagement.offer_id),
      'Offer',
    );
    if (!['completed', 'cancelled'].includes(offer.status))
      await repo.update('volunteer_offers', offer.id, {
        capacity: offer.capacity + 1,
        status: offer.status === 'full' ? 'open' : offer.status,
      });
  }
  return updated;
}
export function engagementServices(ctx: Context) {
  return {
    async listEngagements(actor: User) {
      const feedback = await ctx.db.list('feedback', {
        submitted_by: actor.id,
      });
      return (await ctx.db.list('engagements'))
        .filter(
          (engagement) =>
            isOperator(actor) || isEngagementMember(actor.id, engagement),
        )
        .map((engagement) => ({
          ...engagement,
          feedback_submitted: feedback.some(
            (item) => item.engagement_id === engagement.id,
          ),
        }))
        .sort((a, b) => b.created_at.localeCompare(a.created_at));
    },
    async createEngagement(actor: User, input: unknown) {
      const data = engagementSchema.parse(input);
      return ctx.db.transaction((repo) =>
        'match_id' in data
          ? acceptMatch(ctx, repo, actor, data.match_id, data)
          : reserveOffer(ctx, repo, actor, data.offer_id),
      );
    },
    async getEngagement(actor: User, id: string) {
      const engagement = requireFound(
        await ctx.db.get('engagements', id),
        'Engagement',
      );
      if (!isOperator(actor) && !isEngagementMember(actor.id, engagement))
        fail('FORBIDDEN', 'This engagement is private', 403);
      return engagement;
    },
    async updateEngagement(actor: User, id: string, input: unknown) {
      const { status } = engagementPatchSchema.parse(input);
      return ctx.db.transaction(async (repo) => {
        const engagement = requireFound(
          await repo.get('engagements', id),
          'Engagement',
        );
        if (actor.role !== 'admin' && !isEngagementMember(actor.id, engagement))
          fail(
            'FORBIDDEN',
            'Only an engagement member or administrator may change it',
            403,
          );
        return transitionEngagement(ctx, repo, engagement, status);
      });
    },
  };
}
