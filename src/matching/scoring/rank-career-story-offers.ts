import type {
  CareerStoryOffer,
  CareerStoryPreferences,
  RankedCareerStoryOffer,
} from '../types/career-story.js';
import { findOverlap } from '../availability/find-overlap.js';
import { windowDurationMinutes } from '../availability/windows.js';
import { tagOverlap, overlapRatio } from './normalize-tags.js';

const WEIGHTS = {
  topicIndustry: 40,
  time: 25,
  mode: 15,
  language: 10,
  access: 10,
} as const;

const DEFAULT_LIMIT = 5;

function weekdayInSingapore(iso: string): string {
  return new Intl.DateTimeFormat('en-US', {
    weekday: 'long',
    timeZone: 'Asia/Singapore',
  }).format(new Date(iso));
}

/**
 * Ranks published career_story offers against a participant's preferences.
 * This is intentionally separate from matchVolunteers: the initiation
 * direction is reversed (volunteer publishes, participant reserves), so the
 * only hard filter is remaining capacity — everything else is scored.
 */
export function rankCareerStoryOffers(
  participant: CareerStoryPreferences,
  offers: CareerStoryOffer[],
  options?: { limit?: number },
): RankedCareerStoryOffer[] {
  const limit = options?.limit ?? DEFAULT_LIMIT;

  const ranked = offers
    .filter((offer) => offer.capacityRemaining > 0)
    .map((offer) => {
      const reasons: string[] = [];
      let score = 0;

      const topicMatches = tagOverlap(participant.topicTags, offer.topicTags);
      const industryMatches = tagOverlap(
        participant.industryTags,
        offer.industryTags,
      );
      const topicRatio = overlapRatio(participant.topicTags, offer.topicTags);
      const industryRatio = overlapRatio(
        participant.industryTags,
        offer.industryTags,
      );
      const topicIndustryScore =
        Math.max(topicRatio, industryRatio) * WEIGHTS.topicIndustry;
      score += topicIndustryScore;
      if (topicMatches.length > 0)
        reasons.push(`Covers ${topicMatches.join(', ')}`);
      if (industryMatches.length > 0)
        reasons.push(`Industry match: ${industryMatches.join(', ')}`);

      const offerWindow = { start: offer.startsAt, end: offer.endsAt };
      const requiredMinutes = windowDurationMinutes(offerWindow);
      const overlaps = findOverlap(
        participant.availabilityWindows,
        [offerWindow],
        requiredMinutes,
      );
      const timeScore = overlaps.length > 0 ? WEIGHTS.time : 0;
      score += timeScore;
      if (overlaps.length > 0) {
        reasons.push(
          `Fits your availability on ${weekdayInSingapore(offer.startsAt)}`,
        );
      }

      const modeMatches =
        participant.preferredMode === 'either' ||
        participant.preferredMode === offer.mode;
      const modeScore = modeMatches ? WEIGHTS.mode : 0;
      score += modeScore;
      if (modeMatches)
        reasons.push(`Delivered ${offer.mode.replace('_', ' ')}`);

      const languageMatches = tagOverlap(
        participant.languages,
        offer.languages,
      );
      const languageScore =
        overlapRatio(participant.languages, offer.languages) * WEIGHTS.language;
      score += languageScore;
      if (languageMatches.length > 0) {
        reasons.push(
          `Shares participant's preferred language (${languageMatches.join(', ')})`,
        );
      }

      let accessScore: number;
      if (participant.accessPreferences.length === 0) {
        accessScore = WEIGHTS.access;
      } else {
        const accessMatches = tagOverlap(
          participant.accessPreferences,
          offer.accessFeatures,
        );
        accessScore =
          (accessMatches.length / participant.accessPreferences.length) *
          WEIGHTS.access;
        if (accessMatches.length > 0)
          reasons.push(`Supports ${accessMatches.join(', ')}`);
      }
      score += accessScore;

      const result: RankedCareerStoryOffer = {
        offerId: offer.offerId,
        volunteerId: offer.volunteerId,
        score: Math.round(Math.min(100, Math.max(0, score))),
        reasons,
      };
      return result;
    });

  ranked.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    return a.offerId.localeCompare(b.offerId);
  });

  return ranked.slice(0, limit);
}
