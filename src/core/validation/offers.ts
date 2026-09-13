import { z } from 'zod';
import { access, nonempty, tags, text, timestamp, title } from './common.js';
const fields = {
  service_type: z.literal('career_story').default('career_story'),
  title,
  description: text,
  industry_tags: tags.default([]),
  topic_tags: tags.default([]),
  mode: z.enum(['live_online', 'in_person']),
  starts_at: timestamp,
  ends_at: timestamp,
  capacity: z.number().int().min(1).max(100),
  access_features: access.default([]),
  status: z.enum(['draft', 'open']).default('open'),
};
export const offerSchema = z
  .strictObject(fields)
  .refine(
    (v) => Date.parse(v.ends_at) - Date.parse(v.starts_at) === 15 * 60000,
    'Career stories last 15 minutes in this MVP',
  );
export const offerPatchSchema = z
  .strictObject({
    title: title.optional(),
    description: text.optional(),
    industry_tags: tags.optional(),
    topic_tags: tags.optional(),
    mode: fields.mode.optional(),
    starts_at: timestamp.optional(),
    ends_at: timestamp.optional(),
    capacity: fields.capacity.optional(),
    access_features: access.optional(),
    status: z.enum(['open', 'completed', 'cancelled']).optional(),
  })
  .refine(nonempty, 'At least one update is required');
