# Micro-Access Volunteer Platform

Both workstreams are combined: Member 1's JSON API and PostgreSQL persistence,
Member 2's deterministic matching and availability engine, and the integration
that generates/persists matches and ranks career-story offers. The requirements
are in [the build brief](hackathon_codex_backend_spec.md). No frontend is included.

## Run locally

Use Node.js 22.22+ and npm. No Supabase account, Docker, or credentials are needed
for the local demo. It uses embedded PostgreSQL through PGlite, with the same
migrations and repository used by hosted PostgreSQL.

```sh
npm ci
cp .env.example .env
npm run db:migrate
npm run db:seed
npm run dev
```

The API listens at `http://127.0.0.1:3000`. Local data persists in `.data/postgres`,
which is ignored by Git. Stop the API before running migration/seed commands;
only one process should open the embedded database directory at a time.
To start a separate clean demo, set `LOCAL_DATABASE_PATH` to a new directory,
then migrate and seed it.

```sh
curl http://127.0.0.1:3000/api/health
curl http://127.0.0.1:3000/api/me \
  -H 'x-demo-user-id: 00000000-0000-4000-8000-000000000101'
```

For a compiled build:

```sh
npm run build
npm start
```

## Supabase setup: actions for the project owner

1. Create or select a development Supabase project. In **Connect**, copy its
   **Session pooler** connection string (port 5432), or its direct connection
   string if your network supports it. Replace the password placeholder with
   your database password; percent-encode reserved password characters.
   [Supabase connection guide](https://supabase.com/docs/guides/database/connecting-to-postgres).
2. Edit your local `.env`:

   ```env
   DATABASE_MODE=supabase
   SUPABASE_DB_URL=postgresql://<copied-user>:<encoded-password>@<copied-host>:5432/postgres
   DEMO_AUTH_MODE=true
   ```

3. Set `SUPABASE_DB_CA_PATH=supabase/certs/prod-ca-2021.crt` (already included in
   `.env.example`). The project bundles Supabase's public CA certificate for
   verified TLS. If your project requires a different certificate, download it
   from Supabase's database SSL settings and set this variable to that file's
   path. Connection-string SSL flags cannot override the configured verification.
4. With the API stopped, run `npm run db:migrate`, then `npm run db:seed`, then
   `npm run dev`. These commands target the database selected in `.env`.
   Seeding adds only missing demo IDs; it never resets existing bookings or edits.
5. Keep the `micro_access` schema out of Supabase's exposed Data API schemas.
   This server accesses PostgreSQL directly using `pg`, which supports the
   transactions needed for bookings. The database password is required for
   persistence; the service role API key alone is insufficient.

Do not commit `.env`, database passwords, or service role keys. Hosted migration,
seeding, and real bearer-token authentication still require your project setup;
local development and automated tests do not.

If a database command reports `SELF_SIGNED_CERT_IN_CHAIN`, check that
`SUPABASE_DB_CA_PATH` is present in `.env` and points to the bundled certificate
or the CA downloaded for your project. Run commands from the project root when
using the relative path above. Then retry `npm run db:migrate` and
`npm run db:seed`. This supplies the missing CA while keeping certificate
verification enabled. See [certificate provenance](supabase/certs/README.md).

### Optional Supabase Auth

For bearer-token authentication, set:

```env
DEMO_AUTH_MODE=false
SUPABASE_URL=https://<your-project>.supabase.co
SUPABASE_SERVICE_ROLE_KEY=<your-server-side-key>
```

The adapter validates `Authorization: Bearer <access-token>` using Supabase
[`auth.getUser`](https://supabase.com/docs/reference/javascript/auth-getuser).
An operator must provision a `micro_access.users` record with the same UUID as the
Supabase Auth user, the approved role/account type, and the appropriate profile
record. Roles are read from the platform database, never client metadata.
See [provisioning examples](docs/api/profiles.md#operator-provisioning).
The seed creates platform demo identities, not Supabase Auth accounts.
The demo header is ignored when demo auth is disabled. Production startup rejects
both demo authentication and the embedded database mode.

## Demo identities and dates

All names and organisations are fictional. Emails are null.

| Identity                         | UUID suffix           | Full UUID pattern                      |
| -------------------------------- | --------------------- | -------------------------------------- |
| Participants 1–6                 | `101`–`106`           | `00000000-0000-4000-8000-000000000101` |
| Volunteers 1–8                   | `201`–`208`           | `00000000-0000-4000-8000-000000000201` |
| Administrator                    | `301`                 | `00000000-0000-4000-8000-000000000301` |
| Partner facilitator              | `302`                 | `00000000-0000-4000-8000-000000000302` |
| AMA / teaching / review requests | `401` / `402` / `403` | `00000000-0000-4000-8000-000000000401` |
| Career-story offers 1–3          | `501`–`503`           | `00000000-0000-4000-8000-000000000501` |

The fixed demo availability week starts **7 January 2030**. Stories are on
8 January 2030 at 10:00, 11:00, and 12:00 Singapore time. Fixed future dates keep
seeding deterministic; after that week, publish new offers and update availability.
Live engagements can only be completed after their scheduled end. The asynchronous
AMA flow below can be demonstrated immediately.

Participant 6 is partner-managed. Volunteers span technology, design, healthcare,
logistics, finance, and education, with varied availability, services, languages,
and support features. Volunteers 7 and 8 are intentionally unverified so Member 2
can demonstrate its hard filters. Operators are trusted platform-wide accounts;
partner-specific access assignment is a later extension, not an implied public role.

## Example: match and accept the seeded AMA request

Generate matches as the request owner (or a trusted operator). This now calls
Member 2's engine and stores its scores, reasons, and compatible windows atomically.

```sh
curl -X POST http://127.0.0.1:3000/api/requests/00000000-0000-4000-8000-000000000401/matches/generate \
  -H 'Content-Type: application/json' \
  -H 'x-demo-user-id: 00000000-0000-4000-8000-000000000101' \
  -d '{"limit":5}'
```

Use the returned `data[0].id` as `<match-id>`:

```sh
curl -X PATCH http://127.0.0.1:3000/api/matches/<match-id> \
  -H 'Content-Type: application/json' \
  -H 'x-demo-user-id: 00000000-0000-4000-8000-000000000201' \
  -d '{"status":"accepted"}'
```

The response contains `data.match` and `data.engagement`. Complete that engagement
through `PATCH /api/engagements/<engagement-id>` with `{"status":"completed"}`,
then submit feedback through `POST /api/feedback`.

To rank career stories against the signed-in participant's profile:

```sh
curl -X POST http://127.0.0.1:3000/api/offers/rank \
  -H 'Content-Type: application/json' \
  -H 'x-demo-user-id: 00000000-0000-4000-8000-000000000101' \
  -d '{"preferred_mode":"live_online","limit":5}'
```

Supply `availability_windows` to include schedule fit in ranking. To reserve the
first career story:

```sh
curl -X POST http://127.0.0.1:3000/api/engagements \
  -H 'Content-Type: application/json' \
  -H 'x-demo-user-id: 00000000-0000-4000-8000-000000000101' \
  -d '{"offer_id":"00000000-0000-4000-8000-000000000501"}'
```

[All endpoints and input examples](docs/api/README.md) ·
[Combined platform integration](docs/integration.md)

## Verification

```sh
npm run typecheck
npm run lint
npm run format:check
npm test
npm run build
```

Tests run migrations in isolated in-memory PostgreSQL databases and exercise the
actual repository, service layer, and Fastify JSON endpoints. They cover concurrent
booking attempts, lifecycle rollback, validation, role checks, and privacy.
They do not require or connect to a hosted Supabase project. `npm test` runs all
core, matching, and integration suites. For focused checks, use `test:core`,
`test:matching`, or `test:integration`. The lockfile pins dependency versions.

## Structure and ownership

```text
src/core/             Member 1: domain, validation, auth, services, API, SQL repository, seed, tests
src/matching/         Member 2: pure matching, availability, ranking, fixtures, tests
src/integration/      Adapters, transactional matching orchestration, routes, integration tests
supabase/migrations/  Member 1: schema, constraints, lifecycle triggers, access restrictions
scripts/setup.ts      Ordered, transactional migration runner with checksum tracking
docs/api/             Endpoint contracts and examples
docs/integration.md   Combined platform API, adapter contract, and accounting assumptions
```

## Implementation choices and scope

- The private `micro_access` schema avoids collisions with Supabase's auth schema
  and existing public tables. RLS is enabled without client policies. The trusted
  server database owner applies all application permission checks through the API.
- All service mutations take one PostgreSQL row lock in a transaction. This is a
  deliberate MVP throughput tradeoff that coordinates bookings across API
  processes. Move to narrower locks if traffic warrants it; callers need not change.
- `capacity` is remaining seats; `total_capacity` records the original count.
  Cancellation restores a seat once. Booked offers cannot be rescheduled or edited.
- Career stories are exactly 15 minutes in this MVP. Teaching is live only.
  `either` must be resolved to a specific mode at acceptance.
- The API uses `live_online` and `in_person`, never the ambiguous `live` value.
  Timestamps require a timezone and are returned in UTC. Weekly budgets use
  Monday 00:00 in `Asia/Singapore`.
- All declared request access preferences are required at acceptance. No medical
  diagnosis, evidence of disadvantage, or inferred socioeconomic ranking is stored.
- Matching suggestions are advisory. Booking rechecks verification, supported
  services/modes, time conflicts, support needs, and weekly capacity.
- There are no account signup, messaging, answer-delivery, file-upload, payment,
  notification, or UI endpoints. Async content delivery remains a future
  integration; matching and booking are connected now.
