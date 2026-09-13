import { z } from 'zod';
import { bookingFields } from './engagements.js';
import { idSchema, text, windows } from './common.js';
export const matchResultSchema = z.strictObject({
  volunteerId: idSchema,
  score: z.number().min(0).max(100),
  reasons: z.array(text.max(500)).min(1).max(20),
  compatibleWindows: windows,
});
export const saveMatchesSchema = z
  .strictObject({
    request_id: idSchema,
    results: z.array(matchResultSchema).max(50),
  })
  .refine(
    (v) =>
      new Set(v.results.map((r) => r.volunteerId)).size === v.results.length,
    'Each volunteer may appear only once',
  );
export const matchPatchSchema = z.union([
  z.strictObject({ status: z.literal('accepted'), ...bookingFields }),
  z.strictObject({ status: z.enum(['declined', 'expired']) }),
]);
