# Codex Build Brief — Micro-Access Volunteer Platform

## 1. Product goal

Build the **backend/domain layer only** for a hackathon MVP that connects students who lack access to professional networks with higher-profile volunteers who can contribute small, practical units of knowledge.

The product is designed around **time-poor participants and time-poor volunteers**. Interactions should be short, bounded, and easy to fit around school, part-time work, caregiving, and professional commitments.

Do **not** build any UI in these tasks. The UI will be built later on one machine after the two backend workstreams are merged.

Use neutral product language in code:
- `participant` = student / young person requesting access
- `volunteer` = professional contributing expertise
- Do not use `less_privileged`, `normal_student`, or disability diagnoses as role names.
- A participant may optionally declare **access/support preferences**, but the system must not require a disability diagnosis or proof of financial disadvantage.

---

## 2. Four MVP services

| Service key | Product name | Initiated by | Target duration | Default interaction |
|---|---|---|---:|---|
| `ask_me_anything` | Ask Me Anything | Participant | 5–10 min | Async answer or short live call |
| `career_story` | Career Story | Volunteer | 15 min | Volunteer publishes a short session; participant books |
| `teach_me_something` | Teach Me Something | Participant | 20–30 min | Short live teaching session |
| `review_my_work` | Review My Work | Participant | 10–15 min | Async review of text/link/artifact |

### Service rules

#### `ask_me_anything`
Participant submits:
- question
- topic / industry tags
- preferred response mode: `async`, `live`, or `either`
- optional availability if live
- optional support/access preferences

A compatible volunteer can accept and answer.

#### `career_story`
Volunteer publishes:
- career/industry
- story title and short description
- scheduled time or availability window
- delivery mode: `live_online` or `in_person`
- capacity
- optional accessibility/support features

Participants may reserve an available place.

#### `teach_me_something`
Participant submits:
- skill/topic they want to learn
- what they already know
- preferred outcome
- availability
- mode
- optional support/access preferences

The system finds volunteers with relevant expertise and overlapping availability.

#### `review_my_work`
Participant submits:
- what they want reviewed
- review goal
- artifact as either `artifact_text` or `artifact_url`
- topic tags
- optional deadline
- optional support/access preferences

Do not implement raw file uploads for the MVP. Store text and/or a URL only.

---

## 3. MVP principles

1. **Short commitments:** every interaction has a known expected time.
2. **Low friction:** no long applications or mandatory full profiles.
3. **Access-aware, not diagnosis-driven:** store practical support preferences, not medical diagnoses.
4. **Human decision-making:** do not automatically rank a person's worth, potential, socioeconomic status, or disability.
5. **Transparent matching:** return human-readable reasons for every match.
6. **Privacy by default:** do not expose personal contact details before an engagement is accepted.
7. **Hackathon scope:** prefer deterministic logic and clean APIs over production-scale infrastructure.

For safeguarding, assume the MVP is used by:
- users aged 18+, **or**
- participants whose account is managed through an approved partner organisation.

Do not build direct unsupervised messaging for minors.

---

# 4. Default technical stack

If the repository already has a compatible stack, preserve it.

For a fresh repository, use:

- **TypeScript**
- **Node.js**
- **Next.js route handlers or a small TypeScript API server**
- **Supabase Postgres** for persistence
- **Zod** for validation
- **Vitest** or Jest for unit tests

Keep business logic framework-independent wherever possible.

Environment variables should be documented in `.env.example`.

Minimum expected variables:

```env
SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=
DEMO_AUTH_MODE=true
```

`SUPABASE_SERVICE_ROLE_KEY` must only be used server-side.

For local/demo mode, it is acceptable to support a simple test identity header such as `x-demo-user-id`, provided it is isolated behind an auth adapter and clearly marked as non-production behaviour.

---

# 5. Repository boundaries for parallel work

The two members must be able to work independently with minimal merge conflicts.

Use this ownership model:

```text
src/
  core/             # MEMBER 1 OWNS
  matching/         # MEMBER 2 OWNS
  integration/      # leave empty or minimal; wire together after merge
```

If using Next.js:

```text
app/api/            # MEMBER 1 OWNS
src/core/           # MEMBER 1 OWNS
src/matching/       # MEMBER 2 OWNS
src/integration/    # final merge work only
```

Rules:
- Member 1 must not edit files under `src/matching/`.
- Member 2 must not edit `app/api/`, database migrations, or files under `src/core/`.
- Member 2 develops against plain TypeScript interfaces and local fixtures.
- Final integration should require an adapter, not a rewrite.
- No UI files should be created by either member.

---

# 6. Shared domain contract

Both workstreams must follow these values exactly.

```ts
export type UserRole =
  | "participant"
  | "volunteer"
  | "facilitator"
  | "admin";

export type ServiceType =
  | "ask_me_anything"
  | "career_story"
  | "teach_me_something"
  | "review_my_work";

export type InteractionMode =
  | "async"
  | "live_online"
  | "in_person"
  | "either";

export type RequestStatus =
  | "open"
  | "matched"
  | "accepted"
  | "completed"
  | "cancelled";

export type OfferStatus =
  | "draft"
  | "open"
  | "full"
  | "completed"
  | "cancelled";

export type MatchStatus =
  | "suggested"
  | "accepted"
  | "declined"
  | "expired";

export interface TimeWindow {
  start: string; // ISO-8601
  end: string;   // ISO-8601
}
```

Use `Asia/Singapore` as the default timezone for the MVP, while storing timestamps in ISO-8601/UTC where appropriate.

---

# PART A — MEMBER 1
# Core Platform API + Persistence

## Objective

Build the reliable platform backbone:
- persistence
- validation
- service/request lifecycle
- volunteer career-story offers
- engagement/booking persistence
- demo authentication
- seed data
- documented API contracts

Do not implement matching/scoring logic. Provide a clean place for Member 2's matching module to be connected later.

---

## A1. Data model

Implement tables/entities equivalent to the following.

### `users`
- `id`
- `role`
- `display_name`
- `email` nullable in demo data
- `account_type`: `individual_18_plus | partner_managed`
- `created_at`
- `updated_at`

### `participant_profiles`
- `user_id`
- `languages: string[]`
- `topic_interests: string[]`
- `industry_interests: string[]`
- `preferred_modes: InteractionMode[]`
- `access_preferences: string[]`
- `time_constraints: string | null`

Examples of `access_preferences`:
- `simple_language`
- `written_instructions`
- `support_person_welcome`
- `step_by_step_explanation`
- `quiet_environment`
- `wheelchair_access`
- `captioning`

Do not store a medical diagnosis as part of the MVP.

### `volunteer_profiles`
- `user_id`
- `headline`
- `organisation`
- `industry_tags: string[]`
- `expertise_tags: string[]`
- `languages: string[]`
- `supported_services: ServiceType[]`
- `supported_access_preferences: string[]`
- `lived_experience_tags: string[]`
- `max_weekly_minutes: number`
- `verification_status: pending | verified | rejected`

`lived_experience_tags` are voluntary and should only describe experiences the volunteer chooses to share, for example:
- `worked_part_time_while_studying`
- `ite_to_poly`
- `career_switcher`
- `first_generation_graduate`

### `service_requests`
Used only for participant-initiated services:
- `id`
- `participant_id`
- `service_type`
- `title`
- `details`
- `topic_tags: string[]`
- `industry_tags: string[]`
- `preferred_mode`
- `duration_minutes`
- `availability_windows`
- `access_preferences`
- `artifact_text` nullable
- `artifact_url` nullable
- `deadline` nullable
- `status`
- `created_at`
- `updated_at`

### `volunteer_offers`
Used for volunteer-initiated `career_story`:
- `id`
- `volunteer_id`
- `service_type` fixed to `career_story`
- `title`
- `description`
- `industry_tags`
- `topic_tags`
- `mode`
- `starts_at`
- `ends_at`
- `capacity`
- `access_features`
- `status`
- `created_at`
- `updated_at`

### `matches`
Persistence for results produced by Member 2:
- `id`
- `request_id`
- `volunteer_id`
- `score`
- `reasons: string[]`
- `suggested_windows`
- `status`
- `created_at`

### `engagements`
Represents an accepted interaction:
- `id`
- `participant_id`
- `volunteer_id`
- `service_type`
- `request_id` nullable
- `offer_id` nullable
- `scheduled_start` nullable
- `scheduled_end` nullable
- `mode`
- `status`: `confirmed | completed | cancelled`
- `created_at`
- `updated_at`

### `feedback`
- `id`
- `engagement_id`
- `submitted_by`
- `helpful: boolean`
- `rating: 1..5` nullable
- `comment` nullable
- `follow_up_requested: boolean`
- `created_at`

---

## A2. Validation rules

Use Zod or equivalent.

Hard rules:
- Participants may create:
  - `ask_me_anything`
  - `teach_me_something`
  - `review_my_work`
- `career_story` must be created as a volunteer offer, not a participant request.
- `ask_me_anything.duration_minutes` must be between 5 and 10.
- `career_story` should normally be 15 minutes.
- `teach_me_something.duration_minutes` must be between 20 and 30.
- `review_my_work.duration_minutes` must be between 10 and 15.
- `review_my_work` requires at least one of:
  - `artifact_text`
  - `artifact_url`
- Live interactions require at least one availability window.
- Async interactions do not require overlapping availability.
- Only volunteers whose `supported_services` contains a service may accept it.
- Do not allow capacity to fall below zero.

---

## A3. API endpoints

Implement JSON APIs roughly equivalent to:

```text
GET    /api/health

GET    /api/me
GET    /api/profiles/:userId
PATCH  /api/profiles/:userId

POST   /api/requests
GET    /api/requests/:id
GET    /api/requests?participantId=&status=&serviceType=
PATCH  /api/requests/:id

POST   /api/offers
GET    /api/offers
GET    /api/offers/:id
PATCH  /api/offers/:id

POST   /api/matches
GET    /api/requests/:id/matches
PATCH  /api/matches/:id

POST   /api/engagements
GET    /api/engagements/:id
PATCH  /api/engagements/:id

POST   /api/feedback
```

Also provide an internal function that integration code can call:

```ts
getMatchingCandidates(requestId: string): Promise<VolunteerCandidate[]>
```

It should return only fields Member 2 needs for matching, not private contact information.

---

## A4. Service lifecycle

Participant-request flow:

```text
OPEN REQUEST
    ↓
MATCHES GENERATED
    ↓
VOLUNTEER ACCEPTS
    ↓
ENGAGEMENT CONFIRMED
    ↓
COMPLETED
    ↓
FEEDBACK
```

Career-story flow:

```text
VOLUNTEER CREATES OFFER
    ↓
OFFER OPEN
    ↓
PARTICIPANT RESERVES SEAT
    ↓
ENGAGEMENT CONFIRMED
    ↓
CAPACITY DECREASES
    ↓
OFFER FULL when capacity is exhausted
```

Implement lifecycle guards so invalid state jumps are rejected.

---

## A5. Seed/demo data

Create enough deterministic data to make integration immediately demonstrable:

- 6 participants
- 8 volunteers
- volunteers across at least 4 industries
- varied expertise
- varied availability
- varied supported services
- several optional accessibility/support features
- 3 career-story offers
- 1 sample request for each participant-initiated service

Do not use real people's personal data.

---

## A6. Member 1 tests

Minimum:
- request validation for all 4 service rules
- participant cannot create `career_story`
- volunteer cannot accept unsupported service
- `review_my_work` fails without an artifact
- career-story capacity cannot be overbooked
- invalid lifecycle transitions fail
- internal candidate function excludes contact details

---

## A7. Member 1 definition of done

Member 1 is done when:
- database schema/migrations exist
- seed script runs successfully
- APIs return typed JSON
- service-specific validation works
- lifecycle rules are tested
- README contains local setup and endpoint examples
- no UI exists
- matching is left as an integration point rather than reimplemented

---

# PART B — MEMBER 2
# Matching + Availability Engine

## Objective

Build a **pure TypeScript matching engine** that can run entirely from local fixtures and unit tests.

It must not depend directly on Supabase, API route files, or Member 1's database schema.

Input: a request/participant preference object plus candidate volunteers/offers.

Output: ranked matches with:
- score
- reasons
- compatible time windows

The engine must be deterministic and explainable.

---

## B1. Local matching interfaces

Implement types equivalent to:

```ts
export interface MatchRequest {
  requestId: string;
  serviceType:
    | "ask_me_anything"
    | "teach_me_something"
    | "review_my_work";
  topicTags: string[];
  industryTags: string[];
  preferredMode:
    | "async"
    | "live_online"
    | "in_person"
    | "either";
  durationMinutes: number;
  availabilityWindows: TimeWindow[];
  languages: string[];
  accessPreferences: string[];
  livedExperiencePreferences?: string[];
}

export interface VolunteerCandidate {
  volunteerId: string;
  supportedServices: ServiceType[];
  expertiseTags: string[];
  industryTags: string[];
  languages: string[];
  availableWindows: TimeWindow[];
  supportedModes: InteractionMode[];
  supportedAccessPreferences: string[];
  livedExperienceTags: string[];
  remainingWeeklyMinutes: number;
  verified: boolean;
}

export interface MatchResult {
  volunteerId: string;
  score: number; // 0..100
  reasons: string[];
  compatibleWindows: TimeWindow[];
}
```

Also implement a separate input/output model for ranking `career_story` offers.

---

## B2. Hard filters

A candidate is ineligible if:
- volunteer is not verified
- requested service is unsupported
- remaining volunteer capacity is below required duration
- requested live mode is unsupported
- a live interaction has no sufficient availability overlap
- a declared essential access requirement cannot be supported

Async `ask_me_anything` and async `review_my_work` should not require schedule overlap.

Never hard-filter based on:
- school
- income
- disability diagnosis
- prestige
- GPA
- race/religion
- inferred socioeconomic status

---

## B3. Scoring model

Use a simple 100-point deterministic score.

Suggested starting weights:

```text
Expertise/topic overlap          35
Industry overlap                 15
Availability quality             20
Language overlap                 10
Access/support compatibility     15
Relevant lived experience         5
                                ---
                                100
```

Rules:
- Hard filters happen before scoring.
- Normalize tag comparison using lower-case canonical strings.
- Exact topic match should score higher than broad industry match.
- Availability score should consider whether the overlap is at least the required duration.
- Access-support compatibility should reward explicitly supported preferences.
- Lived-experience matching is optional and must never dominate expertise.
- Return the top 5 eligible candidates by default.
- Tie-break deterministically, e.g. by `volunteerId`.

Every returned match must include readable reasons, e.g.:

```json
{
  "score": 86,
  "reasons": [
    "Strong match for cybersecurity",
    "Available for a 30-minute slot on Tuesday",
    "Supports written instructions",
    "Shares participant's preferred language"
  ]
}
```

Do not use an LLM to calculate the match score in the MVP.

---

## B4. Availability engine

Implement pure functions:

```ts
findOverlap(
  a: TimeWindow[],
  b: TimeWindow[],
  requiredMinutes: number
): TimeWindow[];

isBookable(
  window: TimeWindow,
  existingBookings: TimeWindow[],
  requiredMinutes: number
): boolean;

suggestSlots(
  participantWindows: TimeWindow[],
  volunteerWindows: TimeWindow[],
  existingBookings: TimeWindow[],
  requiredMinutes: number
): TimeWindow[];
```

Requirements:
- validate that `end > start`
- correctly handle multiple windows
- reject overlaps shorter than the required duration
- prevent double-booking
- return ISO-8601 strings
- be timezone-safe
- include unit tests around Singapore-time examples

---

## B5. Service-specific behaviour

### Ask Me Anything
- Async should prioritize expertise, language, and access preferences.
- Availability is only relevant when live/either resolves to live.

### Teach Me Something
- Expertise and time overlap are both important.
- Require enough live overlap for the requested 20–30 minutes.

### Review My Work
- Async by default.
- Prioritize relevant expertise/industry.
- No calendar overlap required unless explicitly requested as live.

### Career Story
Implement separately:

```ts
rankCareerStoryOffers(
  participantPreferences,
  offers
): RankedCareerStoryOffer[];
```

Rank using:
- industry/topic relevance
- compatible time
- mode
- language
- access features

Do not apply volunteer-request matching logic to career stories because the direction of initiation is reversed.

---

## B6. Test fixtures

Build local fixtures with:
- at least 8 volunteers
- at least 3 career-story offers
- varied industries and tags
- varied availability
- some volunteers that fail hard filters
- different access-support capabilities

Fixtures must not depend on Member 1's database.

---

## B7. Member 2 tests

Minimum:
- best expertise match ranks first
- unsupported service is filtered out
- unverified volunteer is filtered out
- insufficient time overlap is filtered out
- async review does not require overlap
- access requirement affects eligibility/scoring correctly
- language overlap affects score
- deterministic tie-breaking
- career story ranking works separately
- double-booking prevention works

---

## B8. Member 2 exported integration API

Export a small stable public surface:

```ts
export function matchVolunteers(
  request: MatchRequest,
  candidates: VolunteerCandidate[],
  options?: { limit?: number }
): MatchResult[];

export function rankCareerStoryOffers(
  participant: CareerStoryPreferences,
  offers: CareerStoryOffer[],
  options?: { limit?: number }
): RankedCareerStoryOffer[];

export function suggestSlots(...): TimeWindow[];
```

Do not expose internal scoring helpers unless tests require them.

---

## B9. Member 2 definition of done

Member 2 is done when:
- the module works with only local fixtures
- all matching behaviour is deterministic
- all matches include explanations
- availability logic is tested
- all four service types are represented
- there is no database dependency
- there are no API route or UI changes
- README documents how Member 1 can call the exported functions

---

# 7. Final integration contract

After both workstreams are complete, one machine should perform a short integration pass.

Expected wiring:

```text
Member 1 database
      ↓
getMatchingCandidates()
      ↓
adapter: Core Volunteer → VolunteerCandidate
      ↓
Member 2 matchVolunteers()
      ↓
MatchResult[]
      ↓
Member 1 persists results in `matches`
      ↓
future UI calls API
```

For a participant request:

```ts
const request = await core.getRequest(requestId);
const candidates = await core.getMatchingCandidates(requestId);

const results = matchVolunteers(
  toMatchRequest(request),
  candidates.map(toVolunteerCandidate),
  { limit: 5 }
);

await core.saveMatches(requestId, results);
```

For `career_story`, retrieve open offers and call `rankCareerStoryOffers()`.

The integration layer should be the only place where Member 1's persistence types are converted into Member 2's pure matching types.

---

# 8. API response conventions

Use a consistent envelope:

Success:

```json
{
  "data": {},
  "error": null
}
```

Failure:

```json
{
  "data": null,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Human-readable message"
  }
}
```

Prefer stable machine-readable error codes.

Return appropriate HTTP status codes:
- `200` successful read/update
- `201` created
- `400` bad input
- `401` unauthenticated
- `403` wrong role/permission
- `404` missing resource
- `409` lifecycle/capacity conflict
- `500` unexpected server error

---

# 9. Explicitly out of scope

Do **not** spend hackathon time on:

- frontend/UI
- chat/messaging system
- video calls
- payment processing
- real calendar integrations
- raw file uploads
- AI-generated suitability scores
- socioeconomic/disability verification
- medical data
- background-check systems
- production-grade admin panel
- production notifications
- complex recommendation ML
- blockchain/credentials
- a full volunteer marketplace

Use stubs/interfaces where future integrations are obvious.

---

# 10. Quality bar for Codex

Before finishing any task:

1. Inspect the existing repo before changing architecture.
2. Preserve existing conventions where reasonable.
3. Keep functions small and typed.
4. Validate all external inputs.
5. Add tests for domain rules.
6. Run formatter/linter/tests available in the repo.
7. Do not create UI.
8. Do not silently invent third-party credentials.
9. Document any assumption that affects integration.
10. Keep the final work easy to merge with the other member's directory.

Prioritize a clean, demonstrable MVP over completeness.
