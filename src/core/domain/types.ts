export const USER_ROLES = [
  'participant',
  'volunteer',
  'facilitator',
  'admin',
] as const;
export const SERVICE_TYPES = [
  'ask_me_anything',
  'career_story',
  'teach_me_something',
  'review_my_work',
] as const;
export const INTERACTION_MODES = [
  'async',
  'live_online',
  'in_person',
  'either',
] as const;
export const REQUEST_STATUSES = [
  'open',
  'matched',
  'accepted',
  'completed',
  'cancelled',
] as const;
export const OFFER_STATUSES = [
  'draft',
  'open',
  'full',
  'completed',
  'cancelled',
] as const;
export const MATCH_STATUSES = [
  'suggested',
  'accepted',
  'declined',
  'expired',
] as const;
export const ACCESS_PREFERENCES = [
  'simple_language',
  'written_instructions',
  'support_person_welcome',
  'step_by_step_explanation',
  'quiet_environment',
  'wheelchair_access',
  'captioning',
] as const;
export type UserRole = (typeof USER_ROLES)[number];
export type ServiceType = (typeof SERVICE_TYPES)[number];
export type InteractionMode = (typeof INTERACTION_MODES)[number];
export type RequestStatus = (typeof REQUEST_STATUSES)[number];
export type OfferStatus = (typeof OFFER_STATUSES)[number];
export type MatchStatus = (typeof MATCH_STATUSES)[number];
export type ParticipantService = Exclude<ServiceType, 'career_story'>;
export type ResolvedMode = Exclude<InteractionMode, 'either'>;
export interface TimeWindow {
  start: string;
  end: string;
}
export const DEFAULT_TIMEZONE = 'Asia/Singapore';

// Structural contract only: Member 2 owns matching and ranking implementations.
export interface VolunteerCandidate {
  volunteerId: string;
  supportedServices: ServiceType[];
  expertiseTags: string[];
  industryTags: string[];
  languages: string[];
  availableWindows: TimeWindow[];
  supportedModes: InteractionMode[];
  supportedAccessPreferences: string[];
  livedExperienceTags: string[];
  remainingWeeklyMinutes: number;
  verified: boolean;
}
export interface MatchResult {
  volunteerId: string;
  score: number;
  reasons: string[];
  compatibleWindows: TimeWindow[];
}
