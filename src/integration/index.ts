import { createCore } from '../core/index.js';
import type { Database } from '../core/repositories/interfaces.js';
import {
  createMatchingIntegration,
  type CoreOptions,
} from './generate-matches.js';

export function createPlatform(db: Database, options?: CoreOptions) {
  const matching = createMatchingIntegration(db, options);
  return {
    core: {
      ...createCore(db, options),
      createRequest: matching.createRequest,
      updateRequest: matching.updateRequest,
      updateProfile: matching.updateProfile,
      listMatches: matching.listMatches,
    },
    matching,
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
