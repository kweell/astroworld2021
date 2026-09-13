import { z } from 'zod';
import { mode, windows } from '../core/validation/common.js';
const limit = z.number().int().min(1).max(50).default(5);
export const generateMatchesSchema = z.strictObject({ limit });
export const rankOffersSchema = z.strictObject({
  limit,
  preferred_mode: mode.optional(),
  availability_windows: windows.default([]),
});
