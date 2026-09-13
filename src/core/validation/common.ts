import { z } from 'zod';
import { ACCESS_PREFERENCES, INTERACTION_MODES } from '../domain/types.js';
import { normalizeInterest, validInterest } from '../domain/interests.js';
export const idSchema = z.uuid();
export const text = z.string().trim().min(1).max(4000);
export const title = text.max(160);
export const tags = z
  .array(
    z
      .string()
      .trim()
      .min(1)
      .max(80)
      .transform((v) => v.toLowerCase()),
  )
  .max(30)
  .transform((v) => [...new Set(v)]);
export const access = z.array(z.enum(ACCESS_PREFERENCES)).max(7);
export const interestTags = z
  .array(
    z
      .string()
      .transform(normalizeInterest)
      .refine(
        validInterest,
        'Enter a topic or industry of 1–80 characters; replace Others with your own value and do not include markup or commas',
      ),
  )
  .max(30, 'Choose no more than 30 interests')
  .transform((values) => [...new Set(values)]);
export const timestamp = z.iso
  .datetime({ offset: true })
  .transform((v) => new Date(v).toISOString());
export const timeWindow = z
  .strictObject({ start: timestamp, end: timestamp })
  .refine((v) => Date.parse(v.end) > Date.parse(v.start), {
    message: 'Window end must be after start',
  });
export const windows = z.array(timeWindow).max(50);
export const mode = z.enum(INTERACTION_MODES);
export const url = z
  .url()
  .max(2048)
  .refine(
    (v) => ['http:', 'https:'].includes(new URL(v).protocol),
    'Artifact URL must use HTTP or HTTPS',
  );
export const nonempty = (value: object) => Object.keys(value).length > 0;
