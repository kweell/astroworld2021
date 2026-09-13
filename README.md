# Micro-Access Volunteer Platform

Backend for short, practical interactions between participants and volunteers.
The requirements and shared domain contract are in
[the build brief](hackathon_codex_backend_spec.md).

## Planned stack

TypeScript, Node.js with a small API server, Supabase Postgres, Zod, and Vitest.
This scaffold contains folders only; implementation and runnable setup follow.
No frontend is included. The default timezone is `Asia/Singapore`; timestamps
will be stored in UTC where appropriate.

## Project structure

```text
src/
  core/                     Member 1: platform API and persistence
    api/
      routes/               JSON endpoint handlers
      middleware/           Authentication, validation, and error handling
    auth/                   Auth adapter and isolated demo identity support
    domain/                 Shared domain values, entities, and lifecycle rules
    validation/             Service-specific input schemas
    services/               Requests, offers, matches, engagements, feedback
    repositories/           Persistence interfaces and Supabase implementations
    db/                     Server-side database client and database types
    seed/                   Deterministic demo data and seeding entry point
    tests/                  Core validation, lifecycle, privacy, and API tests
  matching/                 Member 2: framework-independent matching engine
    types/                  Local matching input/output contracts
    availability/           Overlap, bookability, and slot suggestion functions
    scoring/                Volunteer and career-story ranking
    fixtures/               Independent deterministic matching fixtures
    tests/                  Matching and availability unit tests
  integration/              Final merge: adapters and wiring only
supabase/
  migrations/               Member 1: tables, constraints, and database functions
docs/
  api/                      Endpoint contracts and request/response examples
scripts/                    Project setup and development utilities
```

## Ownership

- Member 1 owns `src/core/`, database migrations, and the API documentation.
- Member 2 owns `src/matching/` and develops against local interfaces and fixtures.
- Keep `src/integration/` empty until the final integration pass.
- Matching logic must not depend on the API server or Supabase.
- Do not create UI, messaging, raw file upload, or payment functionality.

Empty directories contain `.gitkeep` files so the structure survives a Git clone.

## Environment

Copy `.env.example` to `.env` when setting up the backend. Supabase credentials
must be supplied locally. The service role key is server-side only.
`DEMO_AUTH_MODE=true` is intended only for local/demo use.
