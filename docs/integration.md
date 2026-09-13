# Combined platform

Member 1 owns core persistence, validation, permissions, and booking lifecycle.
Member 2's engine remains pure TypeScript with independent fixtures and no database
or API imports. `src/integration/` adapts the data and connects both workstreams.
The server composition root registers the new routes inside core authentication.

## Use the combined API

- `POST /api/requests/:id/matches/generate` — the request owner or a trusted operator
  generates matches, persists scores/reasons/windows, and advances the request.
  Optional body: `{"limit":5}`. Returns 201 with persisted `Match[]`.
- `POST /api/offers/rank` — the current participant ranks future open career
  stories using their profile and optional `preferred_mode`,
  `availability_windows`, and `limit`. Returns 200 with rankings. It does not
  reserve seats or create participant-request matches.

All responses use the core JSON envelope. Match acceptance and career-story
reservations use the existing engagement endpoints. See the [API contracts](api/README.md).

## Server-side composition

```ts
import { createPlatform } from '../integration/index.js';
import { connectDatabase } from '../core/db/client.js';
import { readConfig } from '../core/config.js';

const db = await connectDatabase(readConfig());
const { core, matching } = createPlatform(db);
// actor is the authenticated platform user, not an ID supplied by the client.
const matches = await matching.generateMatches(actor, requestId, { limit: 5 });
const ranked = await matching.rankOffers(actor, {
  preferred_mode: 'live_online',
  availability_windows: [],
  limit: 5,
});
// The suggested volunteer can accept one returned match:
// await core.createEngagement(volunteerActor, { match_id: matches[0].id });
```

Generation takes the existing PostgreSQL transaction lock, reads current data,
calls `matchVolunteers`, and persists the returned results before releasing the
lock. A transaction-scoped core instance reuses that connection for nested writes.
Consequently, concurrent edits/bookings cannot change the matching inputs between
reading and saving. The engine receives only matching fields, never contacts,
artifacts, display names, or organisation names. Acceptance always rechecks the
current conditions even if a stored suggestion was valid when generated.

## Adapters and contracts

`src/integration/adapters.ts` exports `toMatchRequest`, `toVolunteerCandidate`,
`toCareerStoryPreferences`, and `toCareerStoryOffer`. Core data uses snake_case;
matching data uses camelCase. This is the only conversion layer.

| Core field                      | Matching field                 |
| ------------------------------- | ------------------------------ |
| Request `id`                    | `requestId`                    |
| `service_type`                  | `serviceType`                  |
| `topic_tags` / `industry_tags`  | `topicTags` / `industryTags`   |
| `preferred_mode`                | `preferredMode`                |
| `duration_minutes`              | `durationMinutes`              |
| `availability_windows`          | `availabilityWindows`          |
| Participant profile `languages` | `languages`                    |
| Request `access_preferences`    | `accessPreferences`            |
| Offer `capacity`                | `capacityRemaining`            |
| Offer `access_features`         | `accessFeatures`               |
| Host profile `languages`        | Career-story offer `languages` |

Request access preferences are explicit requirements for that interaction. Profile
preferences are available when composing a new request; they are not silently
merged into saved requests. Career-story access features instead affect ranking,
consistent with Member 2's separate offer model. Participant lived-experience
preferences are not stored in this MVP, so that optional engine field is omitted.

The combined implementation resolves two contract mismatches: all declared request
access requirements must be supported (partial support is ineligible), and every
eligible result has a readable explanation even when no preference tags overlap.
TypeScript's strict array checks are enabled across both members.

## Availability and budgets

Volunteer profiles include `available_windows` and `supported_modes` to support
the shared candidate contract. `core.getMatchingCandidates(requestId)` returns
only the exact `VolunteerCandidate` fields. It subtracts volunteer bookings and
published story schedules; generation also removes the participant's existing
bookings and clips request windows to the current time and any deadline.
Member 2 applies eligibility filters, finds overlap, and ranks candidates.

Weekly budgets begin Monday 00:00 Singapore time. Confirmed/completed request
engagements consume their duration in their scheduled week, or their creation week
for async interactions. Published/full/completed stories consume 15 minutes once
per offer, regardless of attendee count. Draft/cancelled offers and cancelled
engagements consume none. Requests spanning multiple availability weeks receive
the lowest remaining budget across those weeks; async/either includes the current
week. This is conservative because the shared contract exposes one budget value.

Career-story rankings omit past, full, draft, or closed offers, unavailable hosts,
and schedules that conflict with the participant's existing bookings. The engine
then ranks remaining offers by relevance, time, mode, language, and access features.
Reserve a selected `offerId` through the normal engagement service.

## Existing core entry points

`core.getRequest(requestId)` without an actor and
`core.saveMatches(requestId, results)` remain trusted internal methods. They are
useful for other integrations but must not be exposed without authorization.
Operator-only `POST /api/matches` still accepts externally generated results.
`saveMatches` stores `[{volunteerId, score, reasons, compatibleWindows}]` without
recalculating scores. Use the new generation route for this project's engine.

## Verification

`npm test` runs core, matching, and integration tests. Focused commands are
`npm run test:core`, `npm run test:matching`, and `npm run test:integration`.
Integration tests use the real migrations and SQL repository with embedded
PostgreSQL. They cover all three participant services through generation and
acceptance, separate offer ranking/reservation, permissions, busy schedules,
expiry, and readable explanations. No hosted credentials are needed for tests.
