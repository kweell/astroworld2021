import type {
  InteractionMode,
  ParticipantServiceType,
  ServiceType,
  TimeWindow,
} from "./common.js";

/** A participant-initiated request, as seen by the matching engine. */
export interface MatchRequest {
  requestId: string;
  serviceType: ParticipantServiceType;
  topicTags: string[];
  industryTags: string[];
  preferredMode: InteractionMode;
  durationMinutes: number;
  availabilityWindows: TimeWindow[];
  languages: string[];
  accessPreferences: string[];
  livedExperiencePreferences?: string[];
}

/** A volunteer candidate, projected to only what the matching engine needs. */
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
  score: number; // 0..100
  reasons: string[];
  compatibleWindows: TimeWindow[];
}
