import type {
  MatchRequest,
  MatchResult,
  VolunteerCandidate,
} from '../types/volunteer.js';
import { applyHardFilters } from './hard-filters.js';
import { tagOverlap, overlapRatio } from './normalize-tags.js';

export const WEIGHTS = {
  expertise: 35,
  industry: 15,
  availability: 20,
  language: 10,
  access: 15,
  livedExperience: 5,
} as const;

const DEFAULT_LIMIT = 5;

/** Formats an ISO instant as a Singapore-local weekday name, e.g. "Tuesday". */
function weekdayInSingapore(iso: string): string {
  return new Intl.DateTimeFormat('en-US', {
    weekday: 'long',
    timeZone: 'Asia/Singapore',
  }).format(new Date(iso));
}

function scoreCandidate(request: MatchRequest, candidate: VolunteerCandidate) {
  const filterResult = applyHardFilters(request, candidate);
  if (!filterResult.eligible) return null;

  const reasons: string[] = [];
  let score = 0;

  const expertiseMatches = tagOverlap(
    request.topicTags,
    candidate.expertiseTags,
  );
  const expertiseScore =
    overlapRatio(request.topicTags, candidate.expertiseTags) *
    WEIGHTS.expertise;
  score += expertiseScore;
  if (expertiseMatches.length > 0) {
    reasons.push(`Strong match for ${expertiseMatches.join(', ')}`);
  }

  const industryMatches = tagOverlap(
    request.industryTags,
    candidate.industryTags,
  );
  const industryScore =
    overlapRatio(request.industryTags, candidate.industryTags) *
    WEIGHTS.industry;
  score += industryScore;
  if (industryMatches.length > 0) {
    reasons.push(`Experience in ${industryMatches.join(', ')}`);
  }

  const needsSchedule =
    filterResult.liveRequired || request.preferredMode === 'either';
  let availabilityScore: number;
  if (!needsSchedule) {
    availabilityScore = WEIGHTS.availability;
  } else if (filterResult.compatibleWindows.length > 0) {
    availabilityScore = WEIGHTS.availability;
    const day = weekdayInSingapore(filterResult.compatibleWindows[0]!.start);
    reasons.push(
      `Available for a ${request.durationMinutes}-minute slot on ${day}`,
    );
  } else {
    availabilityScore = 0;
  }
  score += availabilityScore;

  const languageMatches = tagOverlap(request.languages, candidate.languages);
  const languageScore =
    overlapRatio(request.languages, candidate.languages) * WEIGHTS.language;
  score += languageScore;
  if (languageMatches.length > 0) {
    reasons.push(
      `Shares participant's preferred language (${languageMatches.join(', ')})`,
    );
  }

  let accessScore: number;
  if (request.accessPreferences.length === 0) {
    accessScore = WEIGHTS.access;
  } else {
    const accessMatches = tagOverlap(
      request.accessPreferences,
      candidate.supportedAccessPreferences,
    );
    accessScore =
      (accessMatches.length / request.accessPreferences.length) *
      WEIGHTS.access;
    if (accessMatches.length > 0) {
      reasons.push(`Supports ${accessMatches.join(', ')}`);
    }
  }
  score += accessScore;

  const livedExperiencePreferences = request.livedExperiencePreferences ?? [];
  let livedExperienceScore = 0;
  if (livedExperiencePreferences.length > 0) {
    const livedMatches = tagOverlap(
      livedExperiencePreferences,
      candidate.livedExperienceTags,
    );
    livedExperienceScore =
      (livedMatches.length / livedExperiencePreferences.length) *
      WEIGHTS.livedExperience;
    if (livedMatches.length > 0) {
      reasons.push(`Relevant lived experience: ${livedMatches.join(', ')}`);
    }
  }
  score += livedExperienceScore;

  const result: MatchResult = {
    volunteerId: candidate.volunteerId,
    score: Math.round(Math.min(100, Math.max(0, score))),
    reasons,
    compatibleWindows: filterResult.compatibleWindows,
  };
  return result;
}

/**
 * Ranks eligible volunteer candidates for a participant request. Deterministic:
 * ties break by ascending volunteerId. Returns the top `options.limit` (default 5).
 */
export function matchVolunteers(
  request: MatchRequest,
  candidates: VolunteerCandidate[],
  options?: { limit?: number },
): MatchResult[] {
  const limit = options?.limit ?? DEFAULT_LIMIT;

  const scored = candidates
    .map((candidate) => scoreCandidate(request, candidate))
    .filter((result): result is MatchResult => result !== null);

  scored.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    return a.volunteerId.localeCompare(b.volunteerId);
  });

  return scored.slice(0, limit);
}
