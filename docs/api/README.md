# JSON API contract

Base URL: `http://127.0.0.1:3000`. All endpoints except health require authentication.
Local demo requests use `x-demo-user-id: <seed UUID>`. Real authentication uses
`Authorization: Bearer <Supabase access token>` when `DEMO_AUTH_MODE=false`.
Send JSON bodies with `Content-Type: application/json` (maximum 64 KiB).
IDs are UUIDs. Timestamp inputs require `Z` or an explicit offset and return UTC.

Every success returns `{"data": <typed result>, "error": null}`. Every failure returns
`{"data": null, "error": {"code": "STABLE_CODE", "message": "Readable explanation"}}`.
Created responses use 201; reads and updates use 200. Invalid input is 400,
missing authentication 401, denied permission 403, missing resources 404,
lifecycle/capacity conflict 409, and unexpected failures 500.
Unknown body fields are rejected, including client-supplied IDs, owner IDs, and
arbitrary status changes. Read entity shapes in `src/core/domain/entities.ts`.
JSON schemas and exact optional/default values are in `src/core/validation/`.

| Method | Endpoint                             | Result in `data`                             | Contract                                        |
| ------ | ------------------------------------ | -------------------------------------------- | ----------------------------------------------- |
| GET    | `/api/health`                        | `{status: "ok", timezone: "Asia/Singapore"}` | Public process liveness                         |
| GET    | `/api/me`                            | `{user, profile}`                            | [Profiles](profiles.md)                         |
| GET    | `/api/profiles/:userId`              | `{user, profile}`                            | [Profiles](profiles.md)                         |
| PATCH  | `/api/profiles/:userId`              | `{user_id, updated: true}`                   | [Profiles](profiles.md)                         |
| POST   | `/api/requests`                      | `ServiceRequest`                             | [Requests](requests.md)                         |
| GET    | `/api/requests`                      | `ServiceRequest[]`                           | [Requests](requests.md)                         |
| GET    | `/api/requests/:id`                  | `ServiceRequest`                             | [Requests](requests.md)                         |
| PATCH  | `/api/requests/:id`                  | `ServiceRequest`                             | [Requests](requests.md)                         |
| POST   | `/api/offers/rank`                   | `RankedCareerStoryOffer[]`                   | [Rank offers](offers.md#rank-offers)            |
| POST   | `/api/offers`                        | `VolunteerOffer`                             | [Offers](offers.md)                             |
| GET    | `/api/offers`                        | `VolunteerOffer[]`                           | [Offers](offers.md)                             |
| GET    | `/api/offers/:id`                    | `VolunteerOffer`                             | [Offers](offers.md)                             |
| PATCH  | `/api/offers/:id`                    | `VolunteerOffer`                             | [Offers](offers.md)                             |
| POST   | `/api/requests/:id/matches/generate` | `Match[]`                                    | [Generate matches](matches.md#generate-matches) |
| POST   | `/api/matches`                       | `Match[]`                                    | [Matches](matches.md)                           |
| GET    | `/api/requests/:id/matches`          | `Match[]`                                    | [Matches](matches.md)                           |
| PATCH  | `/api/matches/:id`                   | `{match, engagement}`                        | [Matches](matches.md)                           |
| POST   | `/api/engagements`                   | `Engagement`                                 | [Engagements](engagements.md)                   |
| GET    | `/api/engagements/:id`               | `Engagement`                                 | [Engagements](engagements.md)                   |
| PATCH  | `/api/engagements/:id`               | `Engagement`                                 | [Engagements](engagements.md)                   |
| POST   | `/api/feedback`                      | `Feedback`                                   | [Feedback](feedback.md)                         |

Useful conflict codes include `INVALID_TRANSITION`, `OFFER_FULL`,
`DUPLICATE_BOOKING`, `UNSUPPORTED_SERVICE`, `UNSUPPORTED_MODE`,
`VOLUNTEER_UNVERIFIED`, `ACCESS_UNSUPPORTED`, `BOOKING_CONFLICT`,
`AVAILABILITY_CONFLICT`, `WEEKLY_CAPACITY_EXCEEDED`, `SCHEDULE_PASSED`,
`DEADLINE_PASSED`, `DEADLINE_EXCEEDED`, `SESSION_NOT_ENDED`,
`OFFER_HAS_BOOKINGS`, `ENGAGEMENT_NOT_COMPLETED`, and `DUPLICATE_FEEDBACK`.
Unexpected SQL details and secrets are not returned to API callers.

List endpoints return arrays without pagination for this bounded demo dataset.
Administrative reads are intended for trusted operators, not ordinary accounts.
