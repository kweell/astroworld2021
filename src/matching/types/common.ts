/**
 * Shared domain contract values relevant to matching. Mirrors the values in
 * `hackathon_codex_backend_spec.md` section 6. Member 2 does not import these
 * from `src/core` to keep the matching engine framework-independent.
 */

export type ServiceType =
  'ask_me_anything' | 'career_story' | 'teach_me_something' | 'review_my_work';

/** Service types a participant can request directly (career_story is volunteer-initiated). */
export type ParticipantServiceType = Exclude<ServiceType, 'career_story'>;

export type InteractionMode = 'async' | 'live_online' | 'in_person' | 'either';

export interface TimeWindow {
  start: string; // ISO-8601
  end: string; // ISO-8601
}
