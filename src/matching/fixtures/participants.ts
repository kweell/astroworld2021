import type { CareerStoryPreferences } from '../types/career-story.js';

/** Deterministic sample participant preferences for ranking career_story offers. */
export const careerStoryParticipant: CareerStoryPreferences = {
  participantId: 'part-1',
  topicTags: ['cybersecurity', 'cloud infrastructure'],
  industryTags: ['technology'],
  preferredMode: 'live_online',
  availabilityWindows: [
    { start: '2025-03-12T00:00:00Z', end: '2025-03-12T04:00:00Z' },
  ],
  languages: ['english'],
  accessPreferences: ['captioning'],
};
