import { z } from 'zod';
import { REQUEST_STATUSES } from '../domain/types.js';
import {
  access,
  idSchema,
  mode,
  nonempty,
  interestTags,
  text,
  timestamp,
  title,
  url,
  windows,
} from './common.js';
const fields = {
  service_type: z.enum([
    'ask_me_anything',
    'teach_me_something',
    'review_my_work',
  ]),
  title,
  details: text,
  topic_tags: interestTags.refine(
    (values) => values.length > 0,
    'Choose at least one topic',
  ),
  industry_tags: interestTags.default([]),
  preferred_mode: mode.default('async'),
  duration_minutes: z.number().int(),
  availability_windows: windows.default([]),
  access_preferences: access.default([]),
  artifact_text: text.max(30000).nullable().default(null),
  artifact_url: url.nullable().default(null),
  deadline: timestamp.nullable().default(null),
  prior_knowledge: text.nullable().default(null),
  desired_outcome: text.nullable().default(null),
  review_goal: text.nullable().default(null),
};
const base = z.strictObject(fields);
export const requestSchema = base.superRefine((v, ctx) => {
  const bounds = {
    ask_me_anything: [5, 10],
    teach_me_something: [20, 30],
    review_my_work: [10, 15],
  } as const;
  const [min, max] = bounds[v.service_type];
  const issue = (path: string, message: string) =>
    ctx.addIssue({ code: 'custom', path: [path], message });
  if (v.duration_minutes < min || v.duration_minutes > max)
    issue(
      'duration_minutes',
      `Expected ${min}–${max} minutes for ${v.service_type}`,
    );
  if (
    v.service_type === 'review_my_work' &&
    !v.artifact_text &&
    !v.artifact_url
  )
    issue('artifact_text', 'A text artifact or URL is required');
  if (v.service_type === 'review_my_work' && !v.review_goal)
    issue('review_goal', 'A review goal is required');
  if (v.service_type === 'teach_me_something') {
    if (!['live_online', 'in_person'].includes(v.preferred_mode))
      issue('preferred_mode', 'Teaching requires a live mode');
    if (!v.prior_knowledge || !v.desired_outcome)
      issue(
        'prior_knowledge',
        'Prior knowledge and desired outcome are required',
      );
  }
  if (
    ['live_online', 'in_person'].includes(v.preferred_mode) &&
    !v.availability_windows.some(
      (w) =>
        Date.parse(w.end) - Date.parse(w.start) >= v.duration_minutes * 60000,
    )
  )
    issue(
      'availability_windows',
      'Live requests require a window long enough for the interaction',
    );
});
// Remove defaults before partial() so omitted PATCH keys never reset saved values.
export const requestPatchSchema = z
  .strictObject({
    title: fields.title.optional(),
    details: fields.details.optional(),
    topic_tags: fields.topic_tags.optional(),
    industry_tags: interestTags.optional(),
    preferred_mode: mode.optional(),
    duration_minutes: fields.duration_minutes.optional(),
    availability_windows: windows.optional(),
    access_preferences: access.optional(),
    artifact_text: text.max(30000).nullable().optional(),
    artifact_url: url.nullable().optional(),
    deadline: timestamp.nullable().optional(),
    prior_knowledge: text.nullable().optional(),
    desired_outcome: text.nullable().optional(),
    review_goal: text.nullable().optional(),
    status: z.literal('cancelled').optional(),
  })
  .refine(nonempty, 'At least one update is required');
export const requestQuerySchema = z.strictObject({
  participantId: idSchema.optional(),
  status: z.enum(REQUEST_STATUSES).optional(),
  serviceType: fields.service_type.optional(),
});
export type RequestInput = z.output<typeof requestSchema>;
