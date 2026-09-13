import { useEffect, useState } from 'react';
import {
  ArrowRight,
  CalendarDays,
  CheckCircle2,
  Clock3,
  ExternalLink,
  Mail,
  Pencil,
  ShieldCheck,
  Users,
} from 'lucide-react';
import {
  type Api,
  type Match,
  type Profile,
  type ServiceRequest,
  type Session,
  type VolunteerOffer,
  dateLabel,
  initials,
  label,
  modeLabel,
  timeLabel,
  toISO,
  localInput,
} from './api';
import {
  ActionForm,
  Badge,
  Empty,
  ErrorNotice,
  Field,
  Loading,
  ServiceIcon,
  services,
} from './components';

export function Person({
  profile,
  compact = false,
}: {
  profile?: Profile;
  compact?: boolean;
}) {
  if (!profile)
    return <span className="muted">Volunteer profile unavailable</span>;
  const p =
    profile.profile && 'headline' in profile.profile ? profile.profile : null;
  return (
    <div className={`person ${compact ? 'compact' : ''}`}>
      <span className="avatar">{initials(profile.user.display_name)}</span>
      <div>
        <strong>
          {profile.user.display_name}
          {p?.verification_status === 'verified' && (
            <ShieldCheck size={15} aria-label="Verified volunteer" />
          )}
        </strong>
        <small>{p?.headline ?? label(profile.user.role)}</small>
      </div>
    </div>
  );
}
export function RequestDetail({
  request,
  api,
  me,
  profiles,
  refresh,
  close,
  edit,
  editTopics,
}: {
  request: ServiceRequest;
  api: Api;
  me: Profile;
  profiles: Record<string, Profile>;
  refresh: () => Promise<void>;
  close: () => void;
  edit: () => void;
  editTopics: () => void;
}) {
  const [matches, setMatches] = useState<Match[]>([]);
  const [people, setPeople] = useState(profiles);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [generated, setGenerated] = useState(false);
  const owner = request.participant_id === me.user.id;
  async function load() {
    const items = await api<Match[]>(`/requests/${request.id}/matches`);
    setMatches(items);
    const ids = [...new Set(items.map((m) => m.volunteer_id))];
    const users = await Promise.all(
      ids.map((id) => api<Profile>(`/profiles/${id}`)),
    );
    setPeople(Object.fromEntries(users.map((p) => [p.user.id, p])));
  }
  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const items = await api<Match[]>(`/requests/${request.id}/matches`);
        const users = await Promise.all(
          [...new Set(items.map((m) => m.volunteer_id))].map((id) =>
            api<Profile>(`/profiles/${id}`),
          ),
        );
        if (active) {
          setMatches(items);
          setPeople(Object.fromEntries(users.map((p) => [p.user.id, p])));
        }
      } catch (e) {
        if (active) setError((e as Error).message);
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [api, request.id, request.updated_at]);
  async function run(action: () => Promise<void>) {
    setError('');
    setBusy(true);
    try {
      await action();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  const activeMatches = matches.filter((m) =>
    ['suggested', 'accepted'].includes(m.status),
  );
  return (
    <>
      <div className="detail-meta">
        <ServiceIcon type={request.service_type} />
        <span>{services[request.service_type].title}</span>
        <Badge status={request.status} />
      </div>
      <p className="detail-copy">{request.details}</p>
      <div className="meta-line">
        <span>
          <Clock3 size={16} />
          {request.duration_minutes} minutes
        </span>
        <span>{modeLabel(request.preferred_mode)}</span>
      </div>
      <div className="request-interest-detail">
        <div className="section-heading">
          <h3>Topics & industries</h3>
          {owner && ['open', 'matched'].includes(request.status) && (
            <button className="text-button" onClick={editTopics}>
              <Pencil size={14} /> Edit topics
            </button>
          )}
        </div>
        <div className="tag-list">
          {[...new Set([...request.topic_tags, ...request.industry_tags])].map(
            (t) => (
              <span key={t}>{label(t)}</span>
            ),
          )}
        </div>
      </div>
      {request.prior_knowledge && (
        <div className="detail-section">
          <h3>Starting point</h3>
          <p>{request.prior_knowledge}</p>
          <h3>Learning goal</h3>
          <p>{request.desired_outcome}</p>
        </div>
      )}
      {request.review_goal && (
        <div className="detail-section">
          <h3>Review focus</h3>
          <p>{request.review_goal}</p>
          {request.artifact_text && (
            <div className="artifact">{request.artifact_text}</div>
          )}
          {request.artifact_url && (
            <a
              className="text-button"
              href={request.artifact_url}
              target="_blank"
              rel="noreferrer"
            >
              Open shared work
              <ExternalLink size={15} />
            </a>
          )}
        </div>
      )}
      {request.availability_windows.length > 0 && (
        <div className="detail-section">
          <h3>Available times · SGT</h3>
          {request.availability_windows.map((w) => (
            <p key={w.start}>
              {dateLabel(w.start)}, {timeLabel(w.start)} – {dateLabel(w.end)},{' '}
              {timeLabel(w.end)}
            </p>
          ))}
        </div>
      )}
      {request.deadline && (
        <p className="muted">
          Needed by {dateLabel(request.deadline)}, {timeLabel(request.deadline)}{' '}
          SGT
        </p>
      )}
      {request.access_preferences.length > 0 && (
        <div className="detail-section">
          <h3>Support preferences</h3>
          <div className="tag-list">
            {request.access_preferences.map((a) => (
              <span key={a}>{label(a)}</span>
            ))}
          </div>
        </div>
      )}
      {error && <ErrorNotice message={error} />}
      <div className="detail-section">
        <div className="section-heading">
          <h3>{owner ? 'Your volunteer matches' : 'Your match'}</h3>
          {owner && ['open', 'matched'].includes(request.status) && (
            <button
              className="button primary small"
              disabled={busy || loading}
              onClick={() =>
                void run(async () => {
                  await api(`/requests/${request.id}/matches/generate`, {
                    limit: 5,
                  });
                  setGenerated(true);
                  await load();
                  await refresh();
                })
              }
            >
              {busy
                ? 'Finding…'
                : activeMatches.length
                  ? 'Refresh matches'
                  : 'Find volunteers'}
              <ArrowRight size={15} />
            </button>
          )}
        </div>
        {loading ? (
          <Loading text="Loading matches…" />
        ) : activeMatches.length ? (
          <div className="match-list">
            {activeMatches.map((match) => (
              <div className="match-card" key={match.id}>
                <div className="match-head">
                  <Person profile={people[match.volunteer_id]} />
                  <span className="match-score">
                    {match.booking.ready ? Math.round(match.score) : 'Review'}
                    <small>
                      {match.booking.ready ? 'match score' : 'topic match'}
                    </small>
                  </span>
                </div>
                <ul className="reason-list">
                  {match.reasons.map((reason) => (
                    <li key={reason}>
                      <CheckCircle2 size={15} />
                      {reason}
                    </li>
                  ))}
                </ul>
                {owner ? (
                  <div className="match-state">
                    {match.status === 'accepted'
                      ? 'Accepted · find your booking in My sessions'
                      : match.booking.ready
                        ? 'Suggested · waiting for the volunteer to accept'
                        : 'Topics match · the volunteer needs to review your booking requirements'}
                  </div>
                ) : (
                  match.status === 'suggested' && (
                    <AcceptMatch
                      match={match}
                      request={request}
                      profile={people[match.volunteer_id] ?? me}
                      recheck={load}
                      openProfile={() => {
                        close();
                        window.location.hash = 'profile';
                      }}
                      api={api}
                      done={async () => {
                        await refresh();
                        close();
                      }}
                    />
                  )
                )}
              </div>
            ))}
          </div>
        ) : (
          <p className="quiet-panel">
            {generated
              ? 'No available volunteers match your request yet. Try broader topics, a different time, or check back later.'
              : owner
                ? 'When you’re ready, find volunteers whose skills, availability and support fit your request.'
                : 'There are no active matches for this request.'}
          </p>
        )}
      </div>
      {owner && ['open', 'matched'].includes(request.status) && (
        <div className="detail-actions">
          <button className="button secondary" disabled={busy} onClick={edit}>
            Edit request
          </button>
          <button
            className="text-button danger"
            disabled={busy}
            onClick={() =>
              void run(async () => {
                await api(
                  `/requests/${request.id}`,
                  { status: 'cancelled' },
                  'PATCH',
                );
                await refresh();
                close();
              })
            }
          >
            Cancel request
          </button>
        </div>
      )}
    </>
  );
}
function AcceptMatch({
  match,
  request,
  profile,
  recheck,
  openProfile,
  api,
  done,
}: {
  match: Match;
  request: ServiceRequest;
  profile: Profile;
  recheck: () => Promise<void>;
  openProfile: () => void;
  api: Api;
  done: () => Promise<void>;
}) {
  const volunteer =
    profile.profile && 'supported_services' in profile.profile
      ? profile.profile
      : null;
  const [mode, setMode] = useState(
    request.preferred_mode === 'either'
      ? volunteer?.supported_modes.includes('async')
        ? 'async'
        : (volunteer?.supported_modes[0] ?? 'async')
      : request.preferred_mode,
  );
  const booking = match.booking;
  const earliest = Math.ceil((Date.now() + 60000) / 60000) * 60000;
  const firstSlot = match.suggested_windows
    .map((window) => ({
      start: Math.max(
        Math.ceil(Date.parse(window.start) / 60000) * 60000,
        earliest,
      ),
      end: Date.parse(window.end),
    }))
    .find(
      (window) => window.end - window.start >= request.duration_minutes * 60000,
    );
  const [declineError, setDeclineError] = useState('');
  const [declining, setDeclining] = useState(false);
  return (
    <>
      {!booking.ready && (
        <div className="booking-requirements">
          <h3>Your topics match. Review these details.</h3>
          <ul>
            {booking.issues.map((issue) => (
              <li key={issue}>{issue}</li>
            ))}
          </ul>
          {volunteer &&
            (booking.missing_access_preferences.length > 0 ||
              booking.missing_service ||
              booking.missing_mode) && (
              <ActionForm
                button="Save to my profile & recheck"
                submit={async (data) => {
                  const patch: Record<string, unknown> = {};
                  if (booking.missing_access_preferences.length) {
                    const confirmed = data.getAll('support').map(String);
                    if (
                      booking.missing_access_preferences.some(
                        (value) => !confirmed.includes(value),
                      )
                    )
                      throw new Error(
                        'Confirm each support option you can provide.',
                      );
                    patch.supported_access_preferences = [
                      ...new Set([
                        ...volunteer.supported_access_preferences,
                        ...confirmed,
                      ]),
                    ];
                  }
                  if (booking.missing_service) {
                    if (!data.has('service'))
                      throw new Error(
                        'Confirm that you can provide this service.',
                      );
                    patch.supported_services = [
                      ...new Set([
                        ...volunteer.supported_services,
                        request.service_type,
                      ]),
                    ];
                  }
                  if (booking.missing_mode) {
                    if (!data.has('mode'))
                      throw new Error(
                        'Confirm the connection format you can support.',
                      );
                    patch.supported_modes = [
                      ...new Set([
                        ...volunteer.supported_modes,
                        String(data.get('mode')),
                      ]),
                    ];
                  }
                  await api(`/profiles/${profile.user.id}`, patch, 'PATCH');
                  await recheck();
                }}
              >
                <p>
                  Only confirm capabilities you can provide. These selections
                  will be saved to your volunteer profile.
                </p>
                {booking.missing_access_preferences.map((value) => (
                  <label className="check-option" key={value}>
                    <input
                      type="checkbox"
                      required
                      name="support"
                      value={value}
                    />
                    <span>I can provide {label(value).toLowerCase()}</span>
                  </label>
                ))}
                {booking.missing_service && (
                  <label className="check-option">
                    <input type="checkbox" name="service" required />
                    <span>
                      I can help with{' '}
                      {services[request.service_type].title.toLowerCase()}
                    </span>
                  </label>
                )}
                {booking.missing_mode &&
                  (request.preferred_mode === 'either' ? (
                    <Field label="A format I can support">
                      <select name="mode" required>
                        <option value="async">In your own time</option>
                        <option value="live_online">Online</option>
                        <option value="in_person">In person</option>
                      </select>
                    </Field>
                  ) : (
                    <label className="check-option">
                      <input
                        type="checkbox"
                        name="mode"
                        value={request.preferred_mode}
                        required
                      />
                      <span>
                        I can connect{' '}
                        {modeLabel(request.preferred_mode).toLowerCase()}
                      </span>
                    </label>
                  ))}
              </ActionForm>
            )}
          <div className="detail-actions">
            <button type="button" className="text-button" onClick={openProfile}>
              Edit availability or other profile details
            </button>
            <button
              type="button"
              className="text-button"
              onClick={() =>
                void recheck().catch((e: Error) => setDeclineError(e.message))
              }
            >
              Check again
            </button>
          </div>
        </div>
      )}
      {booking.ready && (
        <ActionForm
          button="Accept & confirm"
          submit={async (d) => {
            const start = mode !== 'async' ? toISO(d.get('start')) : null;
            await api(
              `/matches/${match.id}`,
              {
                status: 'accepted',
                mode,
                ...(start
                  ? {
                      scheduled_start: start,
                      scheduled_end: new Date(
                        Date.parse(start) + request.duration_minutes * 60000,
                      ).toISOString(),
                    }
                  : {}),
              },
              'PATCH',
            );
            await done();
          }}
        >
          {request.preferred_mode === 'either' && (
            <Field label="How will you connect?">
              <select
                value={mode}
                onChange={(e) => setMode(e.target.value as typeof mode)}
              >
                {(
                  volunteer?.supported_modes ?? [
                    'async',
                    'live_online',
                    'in_person',
                  ]
                ).map((value) => (
                  <option key={value} value={value}>
                    {modeLabel(value)}
                  </option>
                ))}
              </select>
            </Field>
          )}
          {mode !== 'async' && (
            <Field
              label="Session start · SGT"
              hint={`Choose a time within the shared availability. The session lasts ${request.duration_minutes} minutes.`}
            >
              <input
                name="start"
                type="datetime-local"
                required
                defaultValue={
                  firstSlot
                    ? localInput(new Date(firstSlot.start).toISOString())
                    : ''
                }
              />
            </Field>
          )}
        </ActionForm>
      )}
      {declineError && <ErrorNotice message={declineError} />}
      <button
        disabled={declining}
        className="text-button danger"
        onClick={async () => {
          setDeclining(true);
          setDeclineError('');
          try {
            await api(`/matches/${match.id}`, { status: 'declined' }, 'PATCH');
            await done();
          } catch (e) {
            setDeclineError((e as Error).message);
          } finally {
            setDeclining(false);
          }
        }}
      >
        Decline this request
      </button>
    </>
  );
}
export function OfferDetail({
  offer,
  me,
  host,
  api,
  sessions,
  done,
  close,
  edit,
}: {
  offer: VolunteerOffer;
  me: Profile;
  host?: Profile;
  api: Api;
  sessions: Session[];
  done: () => Promise<void>;
  close: () => void;
  edit: () => void;
}) {
  const owner = me.user.id === offer.volunteer_id;
  const booked = sessions.some(
    (s) => s.offer_id === offer.id && s.status !== 'cancelled',
  );
  const bookable =
    offer.status === 'open' &&
    offer.capacity > 0 &&
    Date.parse(offer.starts_at) > Date.now();
  return (
    <>
      <Person profile={host} />
      <p className="detail-copy">{offer.description}</p>
      <div className="booking-summary">
        <div>
          <CalendarDays size={19} />
          <span>
            {dateLabel(offer.starts_at)}
            <small>
              {timeLabel(offer.starts_at)} – {timeLabel(offer.ends_at)} SGT
            </small>
          </span>
        </div>
        <div>
          <Clock3 size={19} />
          <span>
            15 minutes<small>{modeLabel(offer.mode)}</small>
          </span>
        </div>
        <div>
          <Users size={19} />
          <span>
            {offer.capacity} of {offer.total_capacity} seats available
            <small>Small group, plenty of room for questions</small>
          </span>
        </div>
      </div>
      <div className="tag-list">
        {[...offer.industry_tags, ...offer.topic_tags].map((t) => (
          <span key={t}>{label(t)}</span>
        ))}
      </div>
      {offer.access_features.length > 0 && (
        <div className="detail-section">
          <h3>Support available</h3>
          <div className="tag-list">
            {offer.access_features.map((t) => (
              <span key={t}>{label(t)}</span>
            ))}
          </div>
        </div>
      )}
      {me.user.role === 'participant' &&
        (booked ? (
          <div className="success-panel">
            <CheckCircle2 size={20} />
            You have a seat. Your booking is in My sessions.
          </div>
        ) : bookable ? (
          <ActionForm
            button="Book my seat"
            submit={async () => {
              await api('/engagements', { offer_id: offer.id });
              await done();
              close();
            }}
          >
            <p className="muted">
              Reserve your place in this 15-minute career conversation. You can
              cancel from My sessions.
            </p>
          </ActionForm>
        ) : (
          <p className="quiet-panel">
            {offer.status === 'full'
              ? 'All seats have been booked.'
              : 'This story is not available for booking.'}
          </p>
        ))}
      {owner && !['completed', 'cancelled'].includes(offer.status) && (
        <div className="detail-section">
          <button className="button secondary" onClick={edit}>
            Edit story details
          </button>
          <ActionForm
            button="Update story"
            submit={async (d) => {
              await api(
                `/offers/${offer.id}`,
                { status: d.get('status') },
                'PATCH',
              );
              await done();
              close();
            }}
          >
            <Field label="Manage this story">
              <select name="status">
                {offer.status === 'draft' && (
                  <option value="open">Publish story</option>
                )}
                <option value="cancelled">Cancel story and its bookings</option>
                {Date.parse(offer.ends_at) <= Date.now() && (
                  <option value="completed">
                    Mark story and bookings complete
                  </option>
                )}
              </select>
            </Field>
          </ActionForm>
        </div>
      )}
    </>
  );
}
export function SessionDetail({
  session,
  counterpart,
  api,
  done,
  close,
}: {
  session: Session;
  counterpart?: Profile;
  api: Api;
  done: () => Promise<void>;
  close: () => void;
}) {
  const [details, setDetails] = useState<
    ServiceRequest | VolunteerOffer | null
  >(null);
  const [error, setError] = useState('');
  useEffect(() => {
    let active = true;
    api<ServiceRequest | VolunteerOffer>(
      session.request_id
        ? `/requests/${session.request_id}`
        : `/offers/${session.offer_id}`,
    )
      .then((data) => {
        if (active) setDetails(data);
      })
      .catch((e: Error) => {
        if (active) setError(e.message);
      });
    return () => {
      active = false;
    };
  }, [api, session.request_id, session.offer_id]);
  const canComplete =
    !session.scheduled_end || Date.parse(session.scheduled_end) <= Date.now();
  return (
    <>
      <div className="detail-meta">
        <ServiceIcon type={session.service_type} />
        <span>{services[session.service_type].title}</span>
        <Badge status={session.status} />
      </div>
      <div className="detail-section">
        <Person profile={counterpart} />
      </div>
      {details && (
        <>
          <h3>{details.title}</h3>
          <p className="detail-copy">
            {'details' in details ? details.details : details.description}
          </p>
          {'artifact_text' in details && details.artifact_text && (
            <div className="artifact">{details.artifact_text}</div>
          )}
          {'artifact_url' in details && details.artifact_url && (
            <a
              className="text-button"
              href={details.artifact_url}
              target="_blank"
              rel="noreferrer"
            >
              Open shared work
              <ExternalLink size={15} />
            </a>
          )}
        </>
      )}
      {error && <ErrorNotice message={error} />}
      <div className="booking-summary">
        <div>
          <Clock3 size={19} />
          <span>
            {session.duration_minutes} minutes
            <small>{modeLabel(session.mode)}</small>
          </span>
        </div>
        {session.scheduled_start && (
          <div>
            <CalendarDays size={19} />
            <span>
              {dateLabel(session.scheduled_start)}
              <small>
                {timeLabel(session.scheduled_start)} –{' '}
                {timeLabel(session.scheduled_end!)} SGT
              </small>
            </span>
          </div>
        )}
      </div>
      {session.status !== 'cancelled' && (
        <div className="quiet-panel">
          <h3>Connect with each other</h3>
          {counterpart?.user.email ? (
            <a
              className="text-button"
              href={`mailto:${counterpart.user.email}`}
            >
              <Mail size={16} />
              {counterpart.user.email}
            </a>
          ) : (
            <p>
              No contact email is available for this account. For demo
              identities, coordinate through your project team.
            </p>
          )}
          <p>
            Arrange the call or exchange your work using your agreed contact
            method. Chat and video calls are not built into Micro Access.
          </p>
        </div>
      )}
      {session.status === 'confirmed' && (
        <ActionForm
          button="Update session"
          submit={async (d) => {
            await api(
              `/engagements/${session.id}`,
              { status: d.get('status') },
              'PATCH',
            );
            await done();
            close();
          }}
        >
          <Field label="Manage your session">
            <select name="status">
              {canComplete && (
                <option value="completed">Mark as completed</option>
              )}
              <option value="cancelled">Cancel this session</option>
            </select>
          </Field>
          {!canComplete && (
            <p className="muted">
              You can mark this session complete after its scheduled end.
            </p>
          )}
        </ActionForm>
      )}
      {session.status === 'completed' &&
        (session.feedback_submitted ? (
          <div className="success-panel">
            <CheckCircle2 size={20} />
            Thanks. Your feedback has been saved.
          </div>
        ) : (
          <div className="detail-section">
            <h3>How did it go?</h3>
            <ActionForm
              button="Send feedback"
              submit={async (d) => {
                await api('/feedback', {
                  engagement_id: session.id,
                  helpful: d.get('helpful') === 'yes',
                  rating: Number(d.get('rating')),
                  comment: d.get('comment') || null,
                  follow_up_requested: d.get('followup') === 'on',
                });
                await done();
                close();
              }}
            >
              <div className="form-grid">
                <Field label="Was this helpful?">
                  <select name="helpful">
                    <option value="yes">Yes, it helped</option>
                    <option value="no">Not this time</option>
                  </select>
                </Field>
                <Field label="Your rating">
                  <select name="rating" defaultValue="5">
                    {[5, 4, 3, 2, 1].map((n) => (
                      <option key={n} value={n}>
                        {n} / 5
                      </option>
                    ))}
                  </select>
                </Field>
              </div>
              <Field label="Anything you’d like to share? (optional)">
                <textarea rows={3} name="comment" />
              </Field>
              <label className="check-option">
                <input type="checkbox" name="followup" />
                <span>I’d welcome a follow-up</span>
              </label>
            </ActionForm>
          </div>
        ))}
      {session.status === 'cancelled' && (
        <Empty title="This session was cancelled">
          You can explore other opportunities whenever you’re ready.
        </Empty>
      )}
    </>
  );
}
