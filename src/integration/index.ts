import { createCore } from '../core/index.js';
import type { Database } from '../core/repositories/interfaces.js';
import {
  createMatchingIntegration,
  type CoreOptions,
} from './generate-matches.js';

export function createPlatform(db: Database, options?: CoreOptions) {
  return {
    core: createCore(db, options),
    matching: createMatchingIntegration(db, options),
  };
}
export { createMatchingIntegration } from './generate-matches.js';
export type { MatchingIntegration } from './generate-matches.js';
export { registerMatchingRoutes } from './routes.js';
export {
  toMatchRequest,
  toVolunteerCandidate,
  toCareerStoryOffer,
  toCareerStoryPreferences,
} from './adapters.js';
