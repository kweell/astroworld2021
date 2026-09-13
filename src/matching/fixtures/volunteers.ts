import type { VolunteerCandidate } from '../types/volunteer.js';

/**
 * Deterministic, independent fixtures — no dependency on Member 1's seed data
 * or database. Windows are fixed 2025 UTC instants so tests are stable.
 * Covers 4+ industries and several volunteers designed to fail hard filters
 * (unverified, unsupported service, no capacity, mode mismatch, no overlap).
 */
export const volunteers: VolunteerCandidate[] = [
  {
    volunteerId: 'vol-alice',
    supportedServices: ['ask_me_anything', 'teach_me_something'],
    expertiseTags: ['cybersecurity', 'cloud infrastructure'],
    industryTags: ['technology'],
    languages: ['english', 'mandarin'],
    availableWindows: [
      { start: '2025-03-04T02:00:00Z', end: '2025-03-04T04:00:00Z' },
    ], // Tue 10:00-12:00 SGT
    supportedModes: ['live_online', 'either', 'async'],
    supportedAccessPreferences: ['written_instructions', 'captioning'],
    livedExperienceTags: ['career_switcher'],
    remainingWeeklyMinutes: 120,
    verified: true,
  },
  {
    volunteerId: 'vol-bilal',
    supportedServices: ['ask_me_anything', 'review_my_work'],
    expertiseTags: ['product management', 'cybersecurity'],
    industryTags: ['technology', 'finance'],
    languages: ['english'],
    availableWindows: [
      { start: '2025-03-05T01:00:00Z', end: '2025-03-05T03:00:00Z' },
    ],
    supportedModes: ['async', 'either'],
    supportedAccessPreferences: ['simple_language'],
    livedExperienceTags: ['first_generation_graduate'],
    remainingWeeklyMinutes: 90,
    verified: true,
  },
  {
    volunteerId: 'vol-chen',
    supportedServices: ['teach_me_something'],
    expertiseTags: ['data science', 'python'],
    industryTags: ['technology'],
    languages: ['english', 'mandarin'],
    availableWindows: [
      { start: '2025-03-06T05:00:00Z', end: '2025-03-06T06:00:00Z' },
    ],
    supportedModes: ['live_online'],
    supportedAccessPreferences: [],
    livedExperienceTags: [],
    remainingWeeklyMinutes: 60,
    verified: false, // fails hard filter: not verified
  },
  {
    volunteerId: 'vol-devi',
    supportedServices: ['review_my_work'],
    expertiseTags: ['marketing', 'branding'],
    industryTags: ['marketing', 'retail'],
    languages: ['english', 'tamil'],
    availableWindows: [
      { start: '2025-03-07T00:00:00Z', end: '2025-03-07T01:00:00Z' },
    ],
    supportedModes: ['async'],
    supportedAccessPreferences: ['quiet_environment'],
    livedExperienceTags: [],
    remainingWeeklyMinutes: 45,
    verified: true,
  },
  {
    volunteerId: 'vol-erin',
    supportedServices: ['ask_me_anything'],
    expertiseTags: ['law', 'compliance'],
    industryTags: ['legal'],
    languages: ['english'],
    availableWindows: [
      { start: '2025-03-04T02:00:00Z', end: '2025-03-04T02:30:00Z' },
    ],
    supportedModes: ['async'],
    supportedAccessPreferences: [],
    livedExperienceTags: [],
    remainingWeeklyMinutes: 5, // fails hard filter: insufficient remaining capacity
    verified: true,
  },
  {
    volunteerId: 'vol-farah',
    supportedServices: ['teach_me_something'],
    expertiseTags: ['nursing', 'public health'],
    industryTags: ['healthcare'],
    languages: ['english', 'malay'],
    availableWindows: [
      { start: '2025-03-10T09:00:00Z', end: '2025-03-10T10:00:00Z' },
    ],
    supportedModes: ['live_online'],
    supportedAccessPreferences: [
      'step_by_step_explanation',
      'support_person_welcome',
    ],
    livedExperienceTags: ['ite_to_poly'],
    remainingWeeklyMinutes: 100,
    verified: true,
  },
  {
    volunteerId: 'vol-gopal',
    supportedServices: ['review_my_work', 'ask_me_anything'],
    expertiseTags: [
      'cybersecurity',
      'cloud infrastructure',
      'product management',
    ],
    industryTags: ['technology'],
    languages: ['english', 'hindi'],
    availableWindows: [
      { start: '2025-03-04T01:00:00Z', end: '2025-03-04T05:00:00Z' },
    ],
    supportedModes: ['async', 'live_online', 'either'],
    supportedAccessPreferences: [
      'written_instructions',
      'simple_language',
      'captioning',
    ],
    livedExperienceTags: ['worked_part_time_while_studying', 'career_switcher'],
    remainingWeeklyMinutes: 200,
    verified: true,
  },
  {
    volunteerId: 'vol-hana',
    supportedServices: ['ask_me_anything'],
    expertiseTags: ['finance', 'investment banking'],
    industryTags: ['finance'],
    languages: ['english', 'japanese'],
    availableWindows: [
      { start: '2025-03-09T23:00:00Z', end: '2025-03-10T00:00:00Z' },
    ],
    supportedModes: ['live_online'], // requested async in fixtures/requests -> fails mode hard filter
    supportedAccessPreferences: [],
    livedExperienceTags: [],
    remainingWeeklyMinutes: 60,
    verified: true,
  },
  {
    volunteerId: 'vol-ivan',
    supportedServices: ['teach_me_something', 'ask_me_anything'],
    expertiseTags: ['cybersecurity'],
    industryTags: ['technology', 'government'],
    languages: ['english', 'mandarin'],
    availableWindows: [
      { start: '2025-03-11T00:00:00Z', end: '2025-03-11T01:00:00Z' },
    ], // no overlap with the sample teach_me_something request
    supportedModes: ['live_online', 'either'],
    supportedAccessPreferences: ['captioning'],
    livedExperienceTags: [],
    remainingWeeklyMinutes: 80,
    verified: true,
  },
];
