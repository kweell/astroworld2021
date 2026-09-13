import { fail } from './errors.js';
import type { Engagement } from './entities.js';
import type { MatchStatus, OfferStatus, RequestStatus } from './types.js';
const requestTransitions: Record<RequestStatus, RequestStatus[]> = {
  open: ['matched', 'cancelled'],
  matched: ['open', 'accepted', 'cancelled'],
  accepted: ['completed', 'cancelled'],
  completed: [],
  cancelled: [],
};
const offerTransitions: Record<OfferStatus, OfferStatus[]> = {
  draft: ['open', 'cancelled'],
  open: ['full', 'completed', 'cancelled'],
  full: ['open', 'completed', 'cancelled'],
  completed: [],
  cancelled: [],
};
const matchTransitions: Record<MatchStatus, MatchStatus[]> = {
  suggested: ['accepted', 'declined', 'expired'],
  accepted: [],
  declined: [],
  expired: [],
};
const engagementTransitions: Record<
  Engagement['status'],
  Engagement['status'][]
> = { confirmed: ['completed', 'cancelled'], completed: [], cancelled: [] };
export function assertTransition(
  kind: 'request' | 'offer' | 'match' | 'engagement',
  from: string,
  to: string,
): void {
  const graph: Record<string, string[]> = {
    request: requestTransitions,
    offer: offerTransitions,
    match: matchTransitions,
    engagement: engagementTransitions,
  }[kind];
  if (!graph[from]?.includes(to))
    fail('INVALID_TRANSITION', `Cannot change ${kind} from ${from} to ${to}`);
}
