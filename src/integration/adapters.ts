import type {
  ParticipantProfile,
  ServiceRequest,
  VolunteerOffer,
  VolunteerProfile,
} from '../core/domain/entities.js';
import type { VolunteerCandidate as CoreCandidate } from '../core/domain/types.js';
import type {
  CareerStoryOffer,
  CareerStoryPreferences,
  InteractionMode,
  MatchRequest,
  TimeWindow,
  VolunteerCandidate,
} from '../matching/index.js';

export function toMatchRequest(
  request: ServiceRequest,
  participant: ParticipantProfile,
): MatchRequest {
  return {
    requestId: request.id,
    serviceType: request.service_type,
    topicTags: request.topic_tags,
    industryTags: request.industry_tags,
    preferredMode: request.preferred_mode,
    durationMinutes: request.duration_minutes,
    availabilityWindows: request.availability_windows,
    languages: participant.languages,
    accessPreferences: request.access_preferences,
  };
}

export function toVolunteerCandidate(
  candidate: CoreCandidate,
): VolunteerCandidate {
  // Explicit projection keeps contact and profile metadata outside the engine.
  return {
    volunteerId: candidate.volunteerId,
    supportedServices: candidate.supportedServices,
    expertiseTags: candidate.expertiseTags,
    industryTags: candidate.industryTags,
    languages: candidate.languages,
    availableWindows: candidate.availableWindows,
    supportedModes: candidate.supportedModes,
    supportedAccessPreferences: candidate.supportedAccessPreferences,
    livedExperienceTags: candidate.livedExperienceTags,
    remainingWeeklyMinutes: candidate.remainingWeeklyMinutes,
    verified: candidate.verified,
  };
}

export function toCareerStoryPreferences(
  participant: ParticipantProfile,
  availability: TimeWindow[],
  preferredMode?: InteractionMode,
): CareerStoryPreferences {
  return {
    participantId: participant.user_id,
    topicTags: participant.topic_interests,
    industryTags: participant.industry_interests,
    preferredMode:
      preferredMode ??
      (participant.preferred_modes.length === 1
        ? participant.preferred_modes[0]!
        : 'either'),
    availabilityWindows: availability,
    languages: participant.languages,
    accessPreferences: participant.access_preferences,
  };
}

export function toCareerStoryOffer(
  offer: VolunteerOffer,
  volunteer: VolunteerProfile,
): CareerStoryOffer {
  return {
    offerId: offer.id,
    volunteerId: offer.volunteer_id,
    industryTags: offer.industry_tags,
    topicTags: offer.topic_tags,
    mode: offer.mode,
    startsAt: offer.starts_at,
    endsAt: offer.ends_at,
    capacityRemaining: offer.capacity,
    accessFeatures: offer.access_features,
    languages: volunteer.languages,
  };
}
