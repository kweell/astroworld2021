# Feedback

`POST /api/feedback` permits either member of a completed engagement, once each.
There is no administrator override for submitting someone else's feedback.

```json
{
  "engagement_id": "<engagement-uuid>",
  "helpful": true,
  "rating": 5,
  "comment": "The practical example helped.",
  "follow_up_requested": false
}
```

`helpful` is required. `rating` is null or an integer from 1 to 5 (default null).
`comment` defaults to null. `follow_up_requested` defaults to false.
The submitted user ID and creation time are set by the server. Duplicate feedback
and feedback on confirmed/cancelled engagements are rejected.

A follow-up request is stored as feedback only; it does not send a notification,
create a booking, or open a messaging channel.
