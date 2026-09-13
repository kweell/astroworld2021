# Profiles

`GET /api/me` returns the current user and their role-specific profile.
`GET /api/profiles/:userId` returns a public user projection and, for volunteers,
their expertise profile. Email appears only for the owner or a counterpart in a
confirmed/completed engagement. Another participant's profile preferences are
never included. Users remain identified by neutral participant/volunteer roles.

`PATCH /api/profiles/:userId` permits the owner or an administrator. Omitted fields
stay unchanged; supplied arrays replace the stored arrays. Role, account type,
email and user ID cannot be changed through this endpoint. Only an administrator
can set a volunteer's `verification_status`. Fields for a different profile role
are rejected. A successful patch returns `{user_id, updated: true}`.

Participant example:

```json
{
  "languages": ["english", "mandarin"],
  "topic_interests": ["python"],
  "industry_interests": ["technology"],
  "preferred_modes": ["async", "live_online"],
  "access_preferences": ["written_instructions"],
  "time_constraints": "Weekday evenings"
}
```

Volunteer example:

```json
{
  "headline": "Software mentor",
  "organisation": "Fictional Studio",
  "industry_tags": ["technology"],
  "expertise_tags": ["python"],
  "languages": ["english"],
  "supported_services": ["ask_me_anything", "teach_me_something"],
  "supported_access_preferences": ["written_instructions"],
  "lived_experience_tags": ["worked_part_time_while_studying"],
  "max_weekly_minutes": 90,
  "available_windows": [
    { "start": "2030-01-07T10:00:00+08:00", "end": "2030-01-07T12:00:00+08:00" }
  ],
  "supported_modes": ["async", "live_online"]
}
```

Allowed support preferences: `simple_language`, `written_instructions`,
`support_person_welcome`, `step_by_step_explanation`, `quiet_environment`,
`wheelchair_access`, `captioning`. These describe practical accommodations;
there is no diagnosis field. Lived-experience tags are voluntary.

## Operator provisioning

There is no public signup/role-assignment endpoint. An approved operator creates
platform identities and profiles through a trusted database connection.
For real Supabase Auth, use the existing Auth user's UUID in place of the
example UUID below; demo seed UUIDs are not authentication accounts.

```sql
BEGIN;
INSERT INTO micro_access.users (id, role, display_name, email, account_type)
VALUES ('11111111-1111-4111-8111-111111111111', 'participant',
        'Example Participant', NULL, 'individual_18_plus');
INSERT INTO micro_access.participant_profiles (user_id)
VALUES ('11111111-1111-4111-8111-111111111111');
COMMIT;
```

For an approved partner-managed participant, use `partner_managed`. A volunteer
needs a `users` row with role `volunteer` and a `volunteer_profiles` row; verification
defaults to `pending`. An administrator can then verify that profile through PATCH.
Operators are responsible for the 18+ or approved-partner account assumption.
No direct unsupervised messaging is implemented.
