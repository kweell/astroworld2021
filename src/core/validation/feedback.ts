import { z } from 'zod';
import { idSchema, text } from './common.js';
export const feedbackSchema = z.strictObject({
  engagement_id: idSchema,
  helpful: z.boolean(),
  rating: z.number().int().min(1).max(5).nullable().default(null),
  comment: text.nullable().default(null),
  follow_up_requested: z.boolean().default(false),
});
