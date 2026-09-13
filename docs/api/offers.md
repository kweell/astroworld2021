# Volunteer career stories

`POST /api/offers` requires a verified volunteer who supports `career_story` and
the selected live mode. Sessions last exactly 15 minutes in this MVP.

```json
{
  "service_type": "career_story",
  "title": "My path into technology",
  "description": "A short career story with practical next steps.",
  "industry_tags": ["technology"],
  "topic_tags": ["software"],
  "mode": "live_online",
  "starts_at": "2030-01-09T10:00:00+08:00",
  "ends_at": "2030-01-09T10:15:00+08:00",
  "capacity": 3,
  "access_features": ["written_instructions"],
  "status": "open"
}
```

`service_type` defaults to `career_story`; `status` defaults to `open` or may be
`draft`. Tags/features default to empty arrays. Capacity is an integer from 1 to 100. An open offer must be in the future, fit the weekly budget and not overlap
another published offer or engagement. The offer's schedule is itself the
volunteer's commitment and need not fall in their general matching availability.

`capacity` in responses means remaining seats; `total_capacity` records the total.
Booking consumes one seat; a full offer has zero remaining seats. Each participant
can hold one active seat. A cancellation restores it once, and reopens a full offer.
Career stories consume 15 volunteer minutes once, regardless of participant count.

`GET /api/offers` lists current open/full offers, plus the owner's own offers.
Operators see all. Drafts are private on `GET /api/offers/:id` as well.

`PATCH /api/offers/:id` requires the owner or an administrator. Before active
bookings, it accepts partial title, description, tags, mode, schedule, capacity,
and access-feature changes. With any non-cancelled booking, these details are
locked. Capacity is managed automatically thereafter.

Status changes must be separate from detail edits: `{"status":"open"}` publishes
a draft; `{"status":"cancelled"}` cancels confirmed seats atomically;
`{"status":"completed"}` completes confirmed seats after the session ends.
Full/completed/cancelled status cannot be used as an arbitrary shortcut.

Reserve through `POST /api/engagements` with `{"offer_id":"<uuid>"}`.
