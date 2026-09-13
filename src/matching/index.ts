// Public surface for Member 1 / integration code. Pure TypeScript, no
// Supabase or API dependencies — see src/matching/README.md.

export type { ServiceType, ParticipantServiceType, InteractionMode, TimeWindow } from "./types/common.js";
export type { MatchRequest, VolunteerCandidate, MatchResult } from "./types/volunteer.js";
export type { CareerStoryPreferences, CareerStoryOffer, RankedCareerStoryOffer } from "./types/career-story.js";

export { matchVolunteers } from "./scoring/match-volunteers.js";
export { rankCareerStoryOffers } from "./scoring/rank-career-story-offers.js";
export { findOverlap } from "./availability/find-overlap.js";
export { isBookable } from "./availability/is-bookable.js";
export { suggestSlots } from "./availability/suggest-slots.js";
