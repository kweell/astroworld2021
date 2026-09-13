# Matching + Availability Engine (Member 2)

Pure TypeScript. No dependency on Supabase, API route files, or Member 1's
database schema — everything here runs from local types and fixtures.

## Public API

```ts
import {
  matchVolunteers,
  rankCareerStoryOffers,
  suggestSlots,
  findOverlap,
  isBookable,
} from "src/matching";
```

### `matchVolunteers(request, candidates, options?) => MatchResult[]`

Ranks eligible volunteers for a participant-initiated request
(`ask_me_anything` / `teach_me_something` / `review_my_work`).

1. Each candidate is run through hard filters (verification, supported
   service, remaining capacity, supported mode, availability overlap for
   live interactions, and access-requirement compatibility). See
   `scoring/hard-filters.ts`.
2. Eligible candidates are scored out of 100 across expertise (35),
   industry (15), availability (20), language (10), access (15), and
   optional lived-experience relevance (5). See `scoring/match-volunteers.ts`.
3. Results are sorted by score descending, ties broken by ascending
   `volunteerId`, and truncated to `options.limit` (default 5).

Every result includes human-readable `reasons` and any `compatibleWindows`
found for scheduling.

### `rankCareerStoryOffers(participant, offers, options?) => RankedCareerStoryOffer[]`

Ranks published `career_story` offers against a participant's preferences.
The only hard filter is `capacityRemaining > 0` — offer initiation is
reversed (volunteer publishes, participant reserves), so everything else
(topic/industry, time fit, mode, language, access) is scored, not filtered.

### `suggestSlots`, `findOverlap`, `isBookable`

Pure availability functions (see `availability/`). All comparisons are done
on absolute instants (`Date.parse`), so they are timezone-safe; inputs and
outputs are ISO-8601 strings. The default product timezone is
`Asia/Singapore`, used only for human-readable reasons (e.g. weekday names).

## How Member 1 / integration should call this

```ts
import { matchVolunteers } from "src/matching";
import type { MatchRequest, VolunteerCandidate } from "src/matching";

// In src/integration/, adapt core.ServiceRequest + core.VolunteerProfile
// into MatchRequest / VolunteerCandidate, then:
const results = matchVolunteers(matchRequest, candidates, { limit: 5 });
// Persist `results` into the `matches` table.
```

For `career_story`, fetch open offers and call `rankCareerStoryOffers`
instead — do not run `matchVolunteers` against career-story offers, since
the initiation direction is reversed.

## Fixtures

`fixtures/` contains independent, deterministic data: 9 volunteers across 6
industries (several deliberately fail hard filters — unverified, no
capacity, unsupported mode, no availability overlap), 4 career-story
offers, and one sample `MatchRequest` per participant-initiated service
type. Nothing here depends on Member 1's seed data.

## Tests

```bash
npm test
```

Covers: availability overlap/booking/slot-suggestion behaviour (including
Singapore-time examples and double-booking prevention), hard-filter
exclusions, scoring/ranking behaviour (best-expertise-first, deterministic
tie-breaking, language/access effects), and career-story ranking.
