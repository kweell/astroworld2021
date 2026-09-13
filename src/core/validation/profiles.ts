import { z } from 'zod';
import { SERVICE_TYPES } from '../domain/types.js';
import {
  access,
  mode,
  nonempty,
  tags,
  text,
  title,
  windows,
} from './common.js';
export const participantProfileSchema = z.strictObject({
  languages: tags.default([]),
  topic_interests: tags.default([]),
  industry_interests: tags.default([]),
  preferred_modes: z.array(mode).default([]),
  access_preferences: access.default([]),
  time_constraints: text.nullable().default(null),
});
export const volunteerProfileSchema = z.strictObject({
  headline: z.string().trim().max(160).default(''),
  organisation: z.string().trim().max(160).default(''),
  industry_tags: tags.default([]),
  expertise_tags: tags.default([]),
  languages: tags.default([]),
  supported_services: z.array(z.enum(SERVICE_TYPES)).default([]),
  supported_access_preferences: access.default([]),
  lived_experience_tags: tags.default([]),
  max_weekly_minutes: z.number().int().min(0).max(2400).default(60),
  verification_status: z
    .enum(['pending', 'verified', 'rejected'])
    .default('pending'),
  available_windows: windows.default([]),
  supported_modes: z
    .array(z.enum(['async', 'live_online', 'in_person']))
    .default([]),
});
export const profilePatchSchema = z
  .strictObject({
    display_name: title.optional(),
    languages: tags.optional(),
    topic_interests: tags.optional(),
    industry_interests: tags.optional(),
    preferred_modes: z.array(mode).optional(),
    access_preferences: access.optional(),
    time_constraints: text.nullable().optional(),
    headline: title.optional(),
    organisation: title.optional(),
    industry_tags: tags.optional(),
    expertise_tags: tags.optional(),
    supported_services: z.array(z.enum(SERVICE_TYPES)).optional(),
    supported_access_preferences: access.optional(),
    lived_experience_tags: tags.optional(),
    max_weekly_minutes: z.number().int().min(0).max(2400).optional(),
    verification_status: z.enum(['pending', 'verified', 'rejected']).optional(),
    available_windows: windows.optional(),
    supported_modes: z
      .array(z.enum(['async', 'live_online', 'in_person']))
      .optional(),
  })
  .refine(nonempty, 'At least one update is required');
