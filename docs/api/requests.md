# Participant requests

`POST /api/requests` is participant-only; the owner is derived from authentication.
Creates a request and automatically invites verified volunteers with overlapping
topics. Missing booking requirements are shown when reviewing a request instead
of suppressing the notification. A request with matches is returned as `matched`; otherwise
it stays `open`. Matching and notification persistence share the creation transaction.
`career_story` is rejected and must use offers.

## Creation examples

Ask Me Anything, 5–10 minutes:

```json
{
  "service_type": "ask_me_anything",
  "title": "Starting in cybersecurity",
  "details": "Which practical skill should I learn first?",
  "topic_tags": ["cybersecurity"],
  "industry_tags": ["technology"],
  "preferred_mode": "async",
  "duration_minutes": 10
}
```

Teach Me Something, 20–30 minutes, live only:

```json
{
  "service_type": "teach_me_something",
  "title": "Learn a Python loop",
  "details": "Help me work through a simple example.",
  "prior_knowledge": "I can create variables.",
  "desired_outcome": "Write a loop over a list.",
  "topic_tags": ["python"],
  "preferred_mode": "live_online",
  "duration_minutes": 25,
  "availability_windows": [
    { "start": "2030-01-07T10:00:00+08:00", "end": "2030-01-07T11:00:00+08:00" }
  ],
  "access_preferences": ["written_instructions"]
}
```

Review My Work, 10–15 minutes:

```json
{
  "service_type": "review_my_work",
  "title": "Review my introduction",
  "details": "This is my portfolio introduction.",
  "review_goal": "Make the introduction clearer.",
  "artifact_text": "I design tools to help people learn.",
  "topic_tags": ["portfolio"],
  "preferred_mode": "async",
  "duration_minutes": 15
}
```

`artifact_text` or an HTTP(S) `artifact_url` is required for review; both may be
provided. No raw uploads. `deadline` is an optional timestamp. `details` holds the
question or context; teaching additionally requires `prior_knowledge` and
`desired_outcome`, and review requires `review_goal`.

`topic_tags` requires at least one topic. Topic and industry arrays allow up to
30 values of 1–80 characters, normalize case/whitespace, and remove duplicates.
Custom values are accepted; the literal placeholder `Others`, blank values,
markup, and comma-separated strings inside an array entry are rejected.
Common optional fields: `industry_tags`, `access_preferences`,
`availability_windows` (all default to empty arrays). `preferred_mode` defaults to
`async`; teaching must explicitly select `live_online` or `in_person`.
Live requests require a sufficiently long availability window. `either` may omit
availability, but acceptance can then resolve only to async. Text is trimmed,
tags are lowercased/deduplicated, and nullable optional fields default to null.

## Read and update

`GET /api/requests?participantId=<uuid>&status=open&serviceType=ask_me_anything`
filters visible requests. Participants see their own; volunteers see requests with
a suggested/accepted match assigned to them; operators can see all. Volunteers
cannot browse unrelated request details or artifacts. The same access check
applies to `GET /api/requests/:id`.

`PATCH /api/requests/:id` allows the owner or an administrator to edit open/matched
requests. Partial changes are merged then fully revalidated. Identity and service
type cannot change. An edit expires current suggestions and reopens the request
before the API automatically rematches it and refreshes notifications. New live
availability and request deadlines must be in the future. Cancellation is a separate patch:

```json
{ "status": "cancelled" }
```

Accepted requests must be completed/cancelled through their engagement. Callers
cannot directly set `matched`, `accepted`, or `completed`.

The web app exposes **Edit topics** on each open/matched request and beside its
topics in the detail view. The editor loads the latest request and sends only
`topic_tags` and `industry_tags`, preserving the other saved fields. It supports
removing existing selections and entering custom values through **Others**.
Repeated saves update the same request; outdated invitations expire and volunteers
matching the new topics receive refreshed notifications. Topic editing requires
at least one topic and is unavailable once the request is booked or closed.
