import { createCore, type Core } from '../core/index.js';
import { fail, requireFound } from '../core/domain/errors.js';
import type { User } from '../core/domain/entities.js';
import { isOperator, requireRole } from '../core/auth/permissions.js';
import type { Database, Repository } from '../core/repositories/interfaces.js';
import {
  busyWindows,
  unreservedWindows,
  usedWeeklyMinutes,
} from '../core/services/booking-rules.js';
import { idSchema } from '../core/validation/common.js';
import {
  isBookable,
  matchVolunteers,
  rankCareerStoryOffers,
} from '../matching/index.js';
import type { CareerStoryOffer } from '../matching/index.js';
import {
  toCareerStoryOffer,
  toCareerStoryPreferences,
  toMatchRequest,
  toVolunteerCandidate,
} from './adapters.js';
import { generateMatchesSchema, rankOffersSchema } from './validation.js';

export type CoreOptions = NonNullable<Parameters<typeof createCore>[1]>;

export function createMatchingIntegration(
  db: Database,
  options: CoreOptions = {},
) {
  const now = options.now ?? (() => new Date());

  // Reuse the existing unit of work: generated scores must describe the same
  // request/availability snapshot that is persisted, even during concurrent edits.
  function inTransaction<T>(
    work: (core: Core, repo: Repository) => Promise<T>,
  ): Promise<T> {
    return db.transaction((repo) => {
      const scopedDatabase: Database = {
        ...repo,
        transaction: (callback) => callback(repo),
        close: async () => {},
      };
      return work(createCore(scopedDatabase, options), repo);
    });
  }

  return {
    async generateMatches(actor: User, requestId: string, input: unknown = {}) {
      idSchema.parse(requestId);
      const { limit } = generateMatchesSchema.parse(input);
      return inTransaction(async (core, repo) => {
        const request = await core.getRequest(requestId, actor);
        if (actor.id !== request.participant_id && !isOperator(actor)) {
          fail(
            'FORBIDDEN',
            'Only the request owner or an operator may generate matches',
            403,
          );
        }
        if (
          request.deadline &&
          Date.parse(request.deadline) <= now().getTime()
        ) {
          fail('DEADLINE_PASSED', 'The request deadline has passed');
        }
        const participant = requireFound(
          await repo.get('participant_profiles', request.participant_id),
          'Participant profile',
        );
        const matchRequest = toMatchRequest(request, participant);
        matchRequest.availabilityWindows = unreservedWindows(
          matchRequest.availabilityWindows,
          await busyWindows(repo, participant.user_id),
        ).flatMap((window) => {
          const start = Math.max(Date.parse(window.start), now().getTime());
          const end = Math.min(
            Date.parse(window.end),
            request.deadline ? Date.parse(request.deadline) : Infinity,
          );
          return end > start
            ? [
                {
                  start: new Date(start).toISOString(),
                  end: new Date(end).toISOString(),
                },
              ]
            : [];
        });
        const candidates = (await core.getMatchingCandidates(requestId)).map(
          toVolunteerCandidate,
        );
        const results = matchVolunteers(matchRequest, candidates, { limit });
        return core.saveMatches(requestId, results);
      });
    },

    async rankOffers(actor: User, input: unknown = {}) {
      requireRole(actor, 'participant');
      const data = rankOffersSchema.parse(input);
      return inTransaction(async (_core, repo) => {
        const participant = requireFound(
          await repo.get('participant_profiles', actor.id),
          'Participant profile',
        );
        const preferences = toCareerStoryPreferences(
          participant,
          data.availability_windows,
          data.preferred_mode,
        );
        const busy = await busyWindows(repo, actor.id);
        const offers: CareerStoryOffer[] = [];
        for (const offer of await repo.list('volunteer_offers', {
          status: 'open',
        })) {
          if (
            offer.capacity <= 0 ||
            Date.parse(offer.starts_at) <= now().getTime()
          )
            continue;
          const host = requireFound(
            await repo.get('volunteer_profiles', offer.volunteer_id),
            'Volunteer profile',
          );
          if (
            host.verification_status !== 'verified' ||
            !host.supported_services.includes('career_story') ||
            !host.supported_modes.includes(offer.mode)
          )
            continue;
          if (
            !isBookable(
              { start: offer.starts_at, end: offer.ends_at },
              busy,
              15,
            )
          )
            continue;
          const used = await usedWeeklyMinutes(
            repo,
            host.user_id,
            offer.starts_at,
            offer.id,
          );
          if (used + 15 > host.max_weekly_minutes) continue;
          offers.push(toCareerStoryOffer(offer, host));
        }
        // Career-story recommendations never create participant-request matches.
        return rankCareerStoryOffers(preferences, offers, {
          limit: data.limit,
        });
      });
    },
  };
}

export type MatchingIntegration = ReturnType<typeof createMatchingIntegration>;
