# Connecting Member 2 after merge

Member 1 does not import, edit, or implement anything in `src/matching/`.
`src/integration/` remains untouched. Add adapters and orchestration there after
Member 2 supplies its pure TypeScript exports.

## Stable core surface

```ts
import { createCore } from '../core/index.js';
import { connectDatabase } from '../core/db/client.js';
import { readConfig } from '../core/config.js';

const db = await connectDatabase(readConfig());
const core = createCore(db);
const request = await core.getRequest(requestId);
const candidates = await core.getMatchingCandidates(requestId);
const participant = await db.get(
  'participant_profiles',
  request.participant_id,
);
// After merge: results = matchVolunteers(toMatchRequest(request, participant), candidates)
// await core.saveMatches(requestId, results);
```

`getRequest(requestId)` without an actor and `saveMatches(requestId, results)` are
trusted internal functions. HTTP handlers must continue to use the authorization
wrappers. `getMatchingCandidates(requestId): Promise<VolunteerCandidate[]>` is a
bound method of the core instance and does not require a global connection.
The structural `VolunteerCandidate` and `MatchResult` types exported by core match
the build brief exactly. There is no dependency on Member 2's type files.

Each candidate contains only `volunteerId`, `supportedServices`, `expertiseTags`,
`industryTags`, `languages`, `availableWindows`, `supportedModes`,
`supportedAccessPreferences`, `livedExperienceTags`, `remainingWeeklyMinutes`, and
`verified`. It never includes email, display name, organisation, or contact details.
Unverified and unsupported candidates are returned so Member 2 owns eligibility
and ranking. The booking service revalidates eligibility before confirming.

Map request fields in the integration adapter:

| Core field                      | Member 2 field               |
| ------------------------------- | ---------------------------- |
| `id`                            | `requestId`                  |
| `service_type`                  | `serviceType`                |
| `topic_tags` / `industry_tags`  | `topicTags` / `industryTags` |
| `preferred_mode`                | `preferredMode`              |
| `duration_minutes`              | `durationMinutes`            |
| `availability_windows`          | `availabilityWindows`        |
| Participant profile `languages` | `languages`                  |
| Request `access_preferences`    | `accessPreferences`          |

Request access preferences are explicit per-interaction requirements; profile
preferences are available for the caller to use when composing a request. The
backend does not silently merge profile preferences into existing requests.
There is no stored participant lived-experience preference field in the MVP;
omit the optional `livedExperiencePreferences` input unless a later schema adds it.

`saveMatches` accepts `[{volunteerId, score, reasons, compatibleWindows}]` and
returns persisted `Match[]`. It replaces current suggestions atomically and does
not compute scores. The HTTP equivalent is operator-only `POST /api/matches`.
Suggested windows describe options; acceptance checks the chosen slot against
current actual availability and reservations, not only stale suggestion windows.

## Availability and capacity assumptions

The volunteer profile adds `available_windows` and `supported_modes` because these
are required by the shared candidate contract but omitted from A1's field list.
The candidate projection subtracts reserved times and published career stories
from raw availability. It does not find overlap, suggest slots, or rank candidates.
Member 2 remains responsible for those operations.

Weekly minutes use Monday 00:00 Singapore time. Confirmed/completed request
engagements consume their duration in their scheduled week; async engagements
consume it in their creation week. Published/full/completed career stories consume
15 minutes once per offer, not per attendee. Draft/cancelled offers and cancelled
engagements consume zero. A request spanning several availability weeks receives
the lowest remaining budget among those weeks; async/either also includes the
current week. This conservative single-number projection avoids overstating a
candidate's availability when the shared contract has no per-week budget map.
Actual acceptance validates the selected week again under the transaction lock.

## Career stories

Fetch open offers through the offer service or repository, then map them to Member
2's independent `CareerStoryOffer` interface and call `rankCareerStoryOffers`.
Join the host's volunteer profile for languages; use offer industry/topic tags,
schedule, mode, remaining `capacity`, and `access_features`. Those are not request
matches, and they must not be persisted in the request `matches` table.
A participant's chosen offer becomes a booking through `createEngagement(actor,
{offer_id})` or `POST /api/engagements`.

## Boundary and test notes

Core database entities use snake_case; Member 2 types use camelCase. Keep any new
conversion in the integration directory. Core uses UTC timestamps, strict mode
values, and fixed deterministic demo IDs documented in the root README.
Member 2 should continue to run entirely from its own local fixtures.
Remove `exclude: ['src/matching/**']` from `vitest.config.ts` once its empty test
placeholders are implemented. Root TypeScript configuration already includes both
members and the integration directory.
