# Engagements and bookings

`GET /api/engagements` returns the authenticated participant or volunteer's own
sessions, newest creation first. Operators can list all sessions. Each result
includes `feedback_submitted`, which reflects only the current caller's feedback.
Unauthenticated callers receive 401. Other participants' bookings are excluded.

`POST /api/engagements` accepts exactly one source. Ownership and service details
are derived on the server; do not send participant IDs, volunteer IDs, or status.

A suggested volunteer accepts a participant request:

```json
{ "match_id": "<match-uuid>" }
```

For live requests, include the agreed slot:

```json
{
  "match_id": "<match-uuid>",
  "mode": "live_online",
  "scheduled_start": "2030-01-07T10:00:00+08:00",
  "scheduled_end": "2030-01-07T10:25:00+08:00"
}
```

A participant reserves a career-story seat:

```json
{ "offer_id": "00000000-0000-4000-8000-000000000501" }
```

The result is a confirmed `Engagement`. Match acceptance through this endpoint
has the same transaction semantics as `PATCH /api/matches/:id` with `accepted`.
Do not call both for one acceptance; a duplicate is rejected.

Live slots must match the requested duration exactly, be in the future, fit both
users' availability, precede any deadline, and avoid existing bookings. A
volunteer's published career story also blocks that time. Group attendees may
share the same offer slot. Async bookings omit scheduled timestamps entirely.
An `either` request must resolve explicitly to `async`, `live_online`, or `in_person`.

`GET /api/engagements/:id` permits the participant, volunteer, or a trusted operator.
`PATCH /api/engagements/:id` permits either engagement member or an administrator:

```json
{ "status": "completed" }
```

or `{"status":"cancelled"}`. Only confirmed engagements may change state.
Live completion requires that the scheduled end has passed. Request engagements
update their parent request. Career-story cancellation restores one seat; repeated
cancellation is rejected. Closing an offer through its endpoint updates all its
confirmed engagements in the same transaction.

No automatic meeting creation or message delivery is performed.
