# Persisting matching results

Only trusted facilitators/administrators may call `POST /api/matches`.
The endpoint stores externally generated results. It never generates or adjusts
scores, ranks people, or infers suitability.

```json
{
  "request_id": "00000000-0000-4000-8000-000000000401",
  "results": [
    {
      "volunteerId": "00000000-0000-4000-8000-000000000201",
      "score": 80,
      "reasons": ["Relevant cybersecurity expertise"],
      "compatibleWindows": []
    }
  ]
}
```

Scores must be 0–100, reasons must be nonempty, and volunteers must exist.
A batch contains at most 50 unique volunteers. Empty results are allowed.
Replacement batches expire earlier suggestions; nonempty batches set the request
to `matched`, empty ones to `open`. Accepted or closed requests cannot be rematched.
Database names `volunteer_id` and `suggested_windows` correspond to integration
fields `volunteerId` and `compatibleWindows`.

`GET /api/requests/:id/matches` permits the request owner, operators, and currently
assigned volunteers. Volunteers see only their own matches, not other volunteers'
scores or explanations. Owners/operators also see declined/expired history.

`PATCH /api/matches/:id` accepts one of:

```json
{ "status": "accepted" }
```

```json
{
  "status": "accepted",
  "mode": "live_online",
  "scheduled_start": "2030-01-07T10:00:00+08:00",
  "scheduled_end": "2030-01-07T10:25:00+08:00"
}
```

```json
{ "status": "declined" }
```

```json
{ "status": "expired" }
```

Only the suggested volunteer may accept/decline. Only operators may expire.
Acceptance atomically confirms the engagement, accepts the request and match,
and expires remaining suggestions. Response: `{match, engagement}`. Declining or
expiring returns `{match, engagement: null}`. When the last suggestion is declined
or expired, the request reopens. Accepted/declined/expired matches are terminal.
Acceptance always rechecks service, verification, mode, support, schedule, and
capacity; persisted matching results are advisory.
