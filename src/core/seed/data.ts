import type { Tables, User, VolunteerProfile } from '../domain/entities.js';
import {
  participantProfileSchema,
  volunteerProfileSchema,
} from '../validation/profiles.js';
import { requestSchema } from '../validation/requests.js';
import { offerSchema } from '../validation/offers.js';
// Stable UUIDs and a fixed future week keep fixtures reproducible without real identities.
export const demoId = (group: number, index: number) =>
  `00000000-0000-4000-8000-${String(group * 100 + index).padStart(12, '0')}`;
export const DEMO_NOW = '2030-01-07T00:00:00.000Z';
export const demoIds = {
  participants: Array.from({ length: 6 }, (_, i) => demoId(1, i + 1)),
  volunteers: Array.from({ length: 8 }, (_, i) => demoId(2, i + 1)),
  admin: demoId(3, 1),
  facilitator: demoId(3, 2),
  requests: [demoId(4, 1), demoId(4, 2), demoId(4, 3)],
  offers: [demoId(5, 1), demoId(5, 2), demoId(5, 3)],
};
const stamp = { created_at: DEMO_NOW, updated_at: DEMO_NOW };
const user = (
  id: string,
  role: User['role'],
  name: string,
  managed = false,
): User => ({
  id,
  role,
  display_name: name,
  email: null,
  account_type: managed ? 'partner_managed' : 'individual_18_plus',
  ...stamp,
});
const industries = [
  'technology',
  'design',
  'healthcare',
  'logistics',
  'finance',
  'education',
  'technology',
  'design',
];
const expertise = [
  ['cybersecurity', 'python'],
  ['portfolio', 'ux'],
  ['healthcare careers'],
  ['supply chain', 'excel'],
  ['accounting', 'resume'],
  ['study skills', 'public speaking'],
  ['web development'],
  ['illustration'],
];
const services: VolunteerProfile['supported_services'][] = [
  ['ask_me_anything', 'teach_me_something', 'review_my_work', 'career_story'],
  ['review_my_work', 'career_story'],
  ['ask_me_anything', 'career_story'],
  ['ask_me_anything', 'teach_me_something'],
  ['ask_me_anything', 'review_my_work'],
  ['teach_me_something'],
  ['ask_me_anything'],
  ['review_my_work'],
];
export function buildSeed(): { [K in keyof Tables]: Tables[K][] } {
  return {
    users: [
      ...demoIds.participants.map((id, i) =>
        user(id, 'participant', `Demo Participant ${i + 1}`, i === 5),
      ),
      ...demoIds.volunteers.map((id, i) =>
        user(id, 'volunteer', `Demo Volunteer ${i + 1}`),
      ),
      user(demoIds.admin, 'admin', 'Demo Administrator'),
      user(demoIds.facilitator, 'facilitator', 'Demo Partner Facilitator'),
    ],
    participant_profiles: demoIds.participants.map((id, i) => ({
      user_id: id,
      ...participantProfileSchema.parse({
        languages: i % 2 ? ['english', 'mandarin'] : ['english'],
        topic_interests: expertise[i],
        industry_interests: [industries[i]],
        preferred_modes: i % 2 ? ['live_online'] : ['async', 'either'],
        access_preferences:
          i % 2 ? ['written_instructions'] : ['simple_language'],
        time_constraints:
          i === 5 ? 'Available after partner programme activities' : null,
      }),
    })),
    volunteer_profiles: demoIds.volunteers.map((id, i) => ({
      user_id: id,
      ...volunteerProfileSchema.parse({
        headline: `Demo ${industries[i]} mentor`,
        organisation: `Fictional Studio ${i + 1}`,
        industry_tags: [industries[i]],
        expertise_tags: expertise[i],
        languages: i % 2 ? ['english', 'mandarin'] : ['english'],
        supported_services: services[i],
        supported_access_preferences:
          i === 0
            ? [
                'simple_language',
                'written_instructions',
                'step_by_step_explanation',
                'captioning',
              ]
            : i === 2
              ? ['wheelchair_access', 'support_person_welcome']
              : ['written_instructions', 'quiet_environment'],
        lived_experience_tags: [
          i % 2 ? 'career_switcher' : 'worked_part_time_while_studying',
        ],
        max_weekly_minutes: i === 4 ? 15 : 90,
        verification_status:
          i === 6 ? 'pending' : i === 7 ? 'rejected' : 'verified',
        available_windows: [
          {
            start: `2030-01-07T${i % 2 ? '11' : '10'}:00:00+08:00`,
            end: `2030-01-07T${i % 2 ? '13' : '12'}:00:00+08:00`,
          },
          {
            start: '2030-01-08T10:00:00+08:00',
            end: '2030-01-08T14:00:00+08:00',
          },
        ],
        supported_modes:
          i === 0
            ? ['async', 'live_online', 'in_person']
            : i % 2
              ? ['async', 'live_online']
              : ['async', 'in_person', 'live_online'],
      }),
    })),
    service_requests: [
      {
        service_type: 'ask_me_anything',
        title: 'Starting in cybersecurity',
        details: 'What should I practise first?',
        duration_minutes: 10,
        topic_tags: ['cybersecurity'],
        industry_tags: ['technology'],
        access_preferences: ['simple_language'],
      },
      {
        service_type: 'teach_me_something',
        title: 'Learn a Python loop',
        details: 'Help me write a small loop.',
        prior_knowledge: 'I can create variables.',
        desired_outcome: 'Write a loop over a list.',
        preferred_mode: 'live_online',
        duration_minutes: 25,
        topic_tags: ['python'],
        availability_windows: [
          {
            start: '2030-01-07T10:00:00+08:00',
            end: '2030-01-07T11:00:00+08:00',
          },
        ],
        access_preferences: ['written_instructions'],
      },
      {
        service_type: 'review_my_work',
        title: 'Portfolio introduction review',
        details: 'Please review my portfolio introduction.',
        review_goal: 'Make the introduction easier to understand.',
        artifact_text: 'I design simple tools that help people learn.',
        duration_minutes: 15,
        topic_tags: ['portfolio'],
        industry_tags: ['design'],
        access_preferences: ['written_instructions'],
      },
    ].map((data, i) => ({
      ...requestSchema.parse(data),
      id: demoIds.requests[i]!,
      participant_id: demoIds.participants[i]!,
      status: 'open',
      ...stamp,
    })),
    volunteer_offers: demoIds.offers.map((id, i) => ({
      ...offerSchema.parse({
        title: `My path into ${industries[i]}`,
        description: 'A short fictional career story and practical next steps.',
        industry_tags: [industries[i]],
        topic_tags: expertise[i],
        mode: i === 2 ? 'in_person' : 'live_online',
        starts_at: `2030-01-08T${10 + i}:00:00+08:00`,
        ends_at: `2030-01-08T${10 + i}:15:00+08:00`,
        capacity: i + 1,
        access_features:
          i === 2
            ? ['wheelchair_access', 'support_person_welcome']
            : ['written_instructions'],
      }),
      id,
      volunteer_id: demoIds.volunteers[i]!,
      total_capacity: i + 1,
      ...stamp,
    })),
    matches: [],
    engagements: [],
    feedback: [],
  };
}
