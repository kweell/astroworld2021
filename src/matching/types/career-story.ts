import type { InteractionMode, TimeWindow } from "./common.js";

/** Participant-side preferences used to rank career_story offers (reverse of MatchRequest). */
export interface CareerStoryPreferences {
  participantId: string;
  topicTags: string[];
  industryTags: string[];
  preferredMode: InteractionMode;
  availabilityWindows: TimeWindow[];
  languages: string[];
  accessPreferences: string[];
}

/** A published, bookable career_story offer. */
export interface CareerStoryOffer {
  offerId: string;
  volunteerId: string;
  industryTags: string[];
  topicTags: string[];
  mode: InteractionMode;
  startsAt: string; // ISO-8601
  endsAt: string; // ISO-8601
  capacityRemaining: number;
  accessFeatures: string[];
  languages: string[];
}

export interface RankedCareerStoryOffer {
  offerId: string;
  volunteerId: string;
  score: number; // 0..100
  reasons: string[];
}
