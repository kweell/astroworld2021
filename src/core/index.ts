import type { Database } from './repositories/interfaces.js';
import { createContext, type Context } from './services/context.js';
import { profileServices } from './services/profiles.js';
import { requestServices } from './services/requests.js';
import { offerServices } from './services/offers.js';
import { matchServices } from './services/matches.js';
import { engagementServices } from './services/engagements.js';
import { feedbackServices } from './services/feedback.js';
import { candidateServices } from './services/matching-candidates.js';
export function createCore(
  db: Database,
  options?: Partial<Pick<Context, 'now' | 'id'>>,
) {
  const ctx = createContext(db, options);
  return {
    ...profileServices(ctx),
    ...requestServices(ctx),
    ...offerServices(ctx),
    ...matchServices(ctx),
    ...engagementServices(ctx),
    ...feedbackServices(ctx),
    ...candidateServices(ctx),
  };
}
export type Core = ReturnType<typeof createCore>;
export type * from './domain/types.js';
export type * from './domain/entities.js';
export type { Database, Repository } from './repositories/interfaces.js';
