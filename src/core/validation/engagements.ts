import { z } from 'zod';
import { idSchema, timestamp } from './common.js';
export const bookingFields = {
  mode: z.enum(['async', 'live_online', 'in_person']).optional(),
  scheduled_start: timestamp.optional(),
  scheduled_end: timestamp.optional(),
};
export const engagementSchema = z.union([
  z.strictObject({ match_id: idSchema, ...bookingFields }),
  z.strictObject({ offer_id: idSchema }),
]);
export const engagementPatchSchema = z.strictObject({
  status: z.enum(['completed', 'cancelled']),
});
