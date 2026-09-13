import type { MatchRequest } from '../types/volunteer.js';

/** One deterministic sample MatchRequest per participant-initiated service type. */

export const askMeAnythingRequest: MatchRequest = {
  requestId: 'req-ama-1',
  serviceType: 'ask_me_anything',
  topicTags: ['cybersecurity'],
  industryTags: ['technology'],
  preferredMode: 'async',
  durationMinutes: 10,
  availabilityWindows: [],
  languages: ['english'],
  accessPreferences: ['written_instructions'],
  livedExperiencePreferences: ['career_switcher'],
};

export const teachMeSomethingRequest: MatchRequest = {
  requestId: 'req-tms-1',
  serviceType: 'teach_me_something',
  topicTags: ['cybersecurity'],
  industryTags: ['technology'],
  preferredMode: 'live_online',
  durationMinutes: 30,
  availabilityWindows: [
    { start: '2025-03-04T02:00:00Z', end: '2025-03-04T04:00:00Z' },
  ],
  languages: ['english', 'mandarin'],
  accessPreferences: [],
};

export const reviewMyWorkRequest: MatchRequest = {
  requestId: 'req-rmw-1',
  serviceType: 'review_my_work',
  topicTags: ['marketing', 'branding'],
  industryTags: ['marketing'],
  preferredMode: 'async',
  durationMinutes: 15,
  availabilityWindows: [],
  languages: ['english'],
  accessPreferences: ['quiet_environment'],
};

export const sampleRequests = [
  askMeAnythingRequest,
  teachMeSomethingRequest,
  reviewMyWorkRequest,
];
