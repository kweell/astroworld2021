import { randomUUID } from 'node:crypto';
import { createCore, type Core } from '../core/index.js';
import { fail, requireFound } from '../core/domain/errors.js';
import type {
  MatchWithReadiness,
  ServiceRequest,
  User,
} from '../core/domain/entities.js';
import { overlappingTopics } from '../core/domain/interests.js';
import { isOperator, requireRole } from '../core/auth/permissions.js';
import type { Database, Repository } from '../core/repositories/interfaces.js';
import {
  busyWindows,
  unreservedWindows,
  usedWeeklyMinutes,
} from '../core/services/booking-rules.js';
import { idSchema } from '../core/validation/common.js';
import {
  applyHardFilters,
  isBookable,
  matchVolunteers,
  rankCareerStoryOffers,
} from '../matching/index.js';
import type { CareerStoryOffer, MatchResult } from '../matching/index.js';
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

  async function prepare(
    core: Core,
    repo: Repository,
    request: ServiceRequest,
  ) {
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
    const candidates = (await core.getMatchingCandidates(request.id)).map(
      toVolunteerCandidate,
    );
    return { matchRequest, candidates };
  }

  async function topicResults(
    core: Core,
    repo: Repository,
    request: ServiceRequest,
  ) {
    const { matchRequest, candidates } = await prepare(core, repo, request);
    const results: MatchResult[] = [];
    for (const candidate of candidates) {
      const topics = overlappingTopics(
        request.topic_tags,
        candidate.expertiseTags,
      );
      if (!candidate.verified || !topics.length) continue;
      const ranked = matchVolunteers(matchRequest, [candidate])[0];
      results.push(
        ranked ?? {
          volunteerId: candidate.volunteerId,
          score: 0,
          reasons: [
            `Topics in common: ${topics.join(', ')}`,
            'Review the booking requirements before accepting this request.',
          ],
          compatibleWindows: applyHardFilters(matchRequest, candidate)
            .compatibleWindows,
        },
      );
    }
    return results;
  }

  async function syncTopicOpportunities(
    core: Core,
    repo: Repository,
    request: ServiceRequest,
  ) {
    if (
      !['open', 'matched'].includes(request.status) ||
      (request.deadline && Date.parse(request.deadline) <= now().getTime())
    )
      return 0;
    const results = await topicResults(core, repo, request);
    const existing = await repo.list('matches', { request_id: request.id });
    let repaired = 0;
    for (const result of results) {
      // Repair adds missing opportunities; it never reopens a declined match.
      const own = existing.filter(
        (match) => match.volunteer_id === result.volunteerId,
      );
      const suggested = own.find((match) => match.status === 'suggested');
      if (
        !suggested &&
        own.some((match) => ['declined', 'accepted'].includes(match.status))
      )
        continue;
      const match =
        suggested ??
        (await repo.insert('matches', {
          id: (options.id ?? randomUUID)(),
          request_id: request.id,
          volunteer_id: result.volunteerId,
          score: result.score,
          reasons: result.reasons,
          suggested_windows: result.compatibleWindows,
          status: 'suggested',
          created_at: now().toISOString(),
        }));
      const notice = (
        await repo.list('notifications', {
          request_id: request.id,
          recipient_id: result.volunteerId,
        })
      )[0];
      if (!notice) {
        await repo.insert('notifications', {
          id: (options.id ?? randomUUID)(),
          request_id: request.id,
          recipient_id: result.volunteerId,
          match_id: match.id,
          created_at: now().toISOString(),
          read_at: null,
        });
        repaired++;
      } else if (notice.match_id !== match.id)
        await repo.update('notifications', notice.id, { match_id: match.id });
    }
    if (
      results.length &&
      (
        await repo.list('matches', {
          request_id: request.id,
          status: 'suggested',
        })
      ).length &&
      (await repo.get('service_requests', request.id))?.status === 'open'
    ) {
      await repo.update('service_requests', request.id, { status: 'matched' });
    }
    return repaired;
  }

  async function generate(
    core: Core,
    repo: Repository,
    actor: User,
    requestId: string,
    limit?: number,
    topicOnly = false,
  ) {
    const request = await core.getRequest(requestId, actor);
    if (actor.id !== request.participant_id && !isOperator(actor)) {
      fail(
        'FORBIDDEN',
        'Only the request owner or an operator may generate matches',
        403,
      );
    }
    if (request.deadline && Date.parse(request.deadline) <= now().getTime()) {
      fail('DEADLINE_PASSED', 'The request deadline has passed');
    }
    const { matchRequest, candidates: allCandidates } = await prepare(
      core,
      repo,
      request,
    );
    const candidates = allCandidates.filter(
      (candidate) =>
        !topicOnly ||
        overlappingTopics(request.topic_tags, candidate.expertiseTags).length >
          0,
    );
    const results = matchVolunteers(matchRequest, candidates, {
      limit: limit ?? Math.min(candidates.length, 50),
    });
    const matches = await core.saveMatches(requestId, results);
    // A topic notification is an invitation to review, not proof that a booking is ready.
    await syncTopicOpportunities(core, repo, request);
    return matches;
  }

  async function saveRequest(actor: User, input: unknown, requestId?: string) {
    return inTransaction(async (core, repo) => {
      const request = requestId
        ? await core.updateRequest(actor, requestId, input)
        : await core.createRequest(actor, input);
      if (request.status === 'cancelled') return request;
      if (
        ['live_online', 'in_person'].includes(request.preferred_mode) &&
        request.availability_windows.some(
          (window) => Date.parse(window.start) <= now().getTime(),
        )
      ) {
        fail(
          'VALIDATION_ERROR',
          'Choose availability that starts in the future',
          400,
        );
      }
      if (requestId) {
        for (const notification of await repo.list('notifications', {
          request_id: requestId,
        })) {
          await repo.update('notifications', notification.id, {
            read_at: null,
            created_at: now().toISOString(),
          });
        }
      }
      // Request, matches, and notifications commit together, or all roll back.
      await generate(core, repo, actor, request.id, undefined, true);
      return core.getRequest(request.id);
    });
  }

  return {
    createRequest: (actor: User, input: unknown) => saveRequest(actor, input),
    updateRequest: (actor: User, id: string, input: unknown) =>
      saveRequest(actor, input, id),
    async repairNotifications() {
      return inTransaction(async (core, repo) => {
        let repaired = 0;
        for (const request of await repo.list('service_requests'))
          repaired += await syncTopicOpportunities(core, repo, request);
        return repaired;
      });
    },
    async updateProfile(actor: User, userId: string, input: unknown) {
      return inTransaction(async (core, repo) => {
        const result = await core.updateProfile(actor, userId, input);
        const user = requireFound(await repo.get('users', userId), 'User');
        if (user.role === 'volunteer') {
          for (const request of await repo.list('service_requests'))
            await syncTopicOpportunities(core, repo, request);
        }
        return result;
      });
    },
    async listMatches(
      actor: User,
      requestId: string,
    ): Promise<MatchWithReadiness[]> {
      return inTransaction(async (core, repo) => {
        const matches = await core.listMatches(actor, requestId);
        const request = await core.getRequest(requestId, actor);
        if (!['open', 'matched'].includes(request.status))
          return matches.map((match) => ({
            ...match,
            booking: {
              ready: false,
              issues: ['This request is already closed or booked.'],
              missing_access_preferences: [],
              missing_service: false,
              missing_mode: false,
            },
          }));
        const { matchRequest, candidates } = await prepare(core, repo, request);
        return matches.map((match) => {
          const candidate = requireFound(
            candidates.find((c) => c.volunteerId === match.volunteer_id),
            'Volunteer candidate',
          );
          const check = applyHardFilters(matchRequest, candidate);
          const ranked = matchVolunteers(matchRequest, [candidate])[0];
          const issues = [...check.failureReasons];
          if (
            request.deadline &&
            Date.parse(request.deadline) <= now().getTime()
          )
            issues.push('The request deadline has passed.');
          if (match.status !== 'suggested')
            issues.push('This match is no longer available for acceptance.');
          return {
            ...match,
            ...(ranked ? { score: ranked.score, reasons: ranked.reasons } : {}),
            suggested_windows: check.compatibleWindows,
            booking: {
              ready: issues.length === 0,
              issues,
              missing_access_preferences: request.access_preferences.filter(
                (value) =>
                  !candidate.supportedAccessPreferences.includes(value),
              ),
              missing_service: !candidate.supportedServices.includes(
                request.service_type,
              ),
              missing_mode:
                request.preferred_mode === 'either'
                  ? candidate.supportedModes.length === 0
                  : !candidate.supportedModes.includes(request.preferred_mode),
            },
          };
        });
      });
    },
    async generateMatches(actor: User, requestId: string, input: unknown = {}) {
      idSchema.parse(requestId);
      const { limit } = generateMatchesSchema.parse(input);
      return inTransaction((core, repo) =>
        generate(core, repo, actor, requestId, limit),
      );
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
