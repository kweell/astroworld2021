import type { MatchRequest, VolunteerCandidate } from '../types/volunteer.js';
import type { TimeWindow } from '../types/common.js';
import { findOverlap } from '../availability/find-overlap.js';
import { normalizeTags, tagOverlap } from './normalize-tags.js';

export interface HardFilterResult {
  eligible: boolean;
  failureReasons: string[];
  /** True when this request/candidate pair must be conducted live (no async fallback). */
  liveRequired: boolean;
  /** Qualifying overlap windows (only computed when scheduling is relevant). */
  compatibleWindows: TimeWindow[];
}

const LIVE_MODES = new Set(['live_online', 'in_person']);

/**
 * Applies the B2 hard filters. Never filters on school, income, disability
 * diagnosis, prestige, GPA, race/religion, or inferred socioeconomic status —
 * none of those fields exist on VolunteerCandidate/MatchRequest by design.
 */
export function applyHardFilters(
  request: MatchRequest,
  candidate: VolunteerCandidate,
): HardFilterResult {
  const failureReasons: string[] = [];

  if (!candidate.verified) {
    failureReasons.push('Volunteer is not verified');
  }
  if (!candidate.supportedServices.includes(request.serviceType)) {
    failureReasons.push(`Volunteer does not support ${request.serviceType}`);
  }
  if (candidate.remainingWeeklyMinutes < request.durationMinutes) {
    failureReasons.push('Volunteer does not have enough remaining capacity');
  }

  const acceptableModes =
    request.preferredMode === 'either'
      ? (['live_online', 'in_person', 'async'] as const)
      : ([request.preferredMode] as const);
  if (
    !acceptableModes.some((mode) => candidate.supportedModes.includes(mode))
  ) {
    failureReasons.push(
      'Volunteer does not support the requested interaction mode',
    );
  }

  if (request.accessPreferences.length > 0) {
    const supported = tagOverlap(
      request.accessPreferences,
      candidate.supportedAccessPreferences,
    );
    if (supported.length !== normalizeTags(request.accessPreferences).length) {
      failureReasons.push(
        "Volunteer cannot support the participant's access requirements",
      );
    }
  }

  // Async requests never require schedule overlap; "either" only requires it
  // when async isn't a fallback option for this volunteer.
  const liveRequired =
    LIVE_MODES.has(request.preferredMode) ||
    (request.preferredMode === 'either' &&
      !candidate.supportedModes.includes('async'));

  let compatibleWindows: TimeWindow[] = [];
  if (liveRequired) {
    compatibleWindows = findOverlap(
      request.availabilityWindows,
      candidate.availableWindows,
      request.durationMinutes,
    );
    if (compatibleWindows.length === 0) {
      failureReasons.push(
        'No sufficient availability overlap for a live interaction',
      );
    }
  } else if (request.preferredMode === 'either') {
    // Informational only: doesn't block eligibility, but improves scoring/reasons.
    compatibleWindows = findOverlap(
      request.availabilityWindows,
      candidate.availableWindows,
      request.durationMinutes,
    );
  }

  return {
    eligible: failureReasons.length === 0,
    failureReasons,
    liveRequired,
    compatibleWindows,
  };
}
