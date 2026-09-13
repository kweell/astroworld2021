# Volunteer notifications

`GET /api/notifications` is volunteer-only and returns only the caller's active
request notifications. Each includes `id`, `request_id`, `match_id`,
`request_title`, `service_type`, `matching_topics`, `duration_minutes`,
`created_at`, and nullable `read_at`. Authenticated recipients can open the
request and accept or decline through the existing match endpoint.

`PATCH /api/notifications/:id` accepts exactly `{ "read": true }`. Only the
recipient can mark a notification read; repeating it keeps the original read time.

Requests created or edited through the combined API automatically generate
topic invitations for verified volunteers even if a booking requirement has not
yet been met. Full ranking and acceptance continue to enforce booking eligibility.
`GET /api/requests/:id/matches` includes a `booking` object with `ready`, `issues`,
`missing_access_preferences`, `missing_service`, and `missing_mode`. Readiness
and shared windows are recomputed against current profiles and bookings.
Volunteers can explicitly update their own capabilities before rechecking.
Notifications persist
in the private `micro_access.notifications` table. One record per request/volunteer
prevents duplicate alerts when matches are refreshed. Request edits reset read
status; manual regeneration preserves it. Cancelled, accepted, expired, or declined
opportunities do not appear in the active list. The browser polls every five
seconds while visible and refreshes when it regains focus.

Apply migration `0004_request_notifications.sql` with `npm run db:migrate` before
starting the updated app. This is an additive migration; existing records are preserved.

Run `node --import tsx scripts/repair-notifications.ts` to restore missing
invitations and notifications for existing open requests. It does not reopen
declines or confirmed/completed/cancelled requests, and preserves read status.
