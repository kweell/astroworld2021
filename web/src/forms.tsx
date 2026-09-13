import { useEffect, useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import {
  ACCESS_PREFERENCES,
  INTERACTION_MODES,
  SERVICE_TYPES,
  type TimeWindow,
} from '../../src/core/domain/types.js';
import {
  type Api,
  type ParticipantService,
  type Profile,
  type ServiceRequest,
  type VolunteerOffer,
  localInput,
  modeLabel,
  tags,
  toISO,
} from './api';
import {
  ActionForm,
  Checks,
  ErrorNotice,
  Field,
  Loading,
  services,
} from './components';
import { InterestSelect } from './interests';
import { readInterests } from './interest-values';
import { TOPICS, INDUSTRIES } from '../../src/core/domain/interests.js';
import { requestSchema } from '../../src/core/validation/requests.js';

function WindowFields({ initial = [] }: { initial?: TimeWindow[] }) {
  const [rows, setRows] = useState(
    initial.map((value, i) => ({ key: i, ...value })),
  );
  function add() {
    setRows([
      ...rows,
      {
        key: Math.max(-1, ...rows.map((row) => row.key)) + 1,
        start: '',
        end: '',
      },
    ]);
  }
  return (
    <div className="window-fields">
      <div className="field-title">
        Availability <span>Singapore time (UTC+8)</span>
      </div>
      {rows.map((row) => (
        <div className="window-row" key={row.key}>
          <Field label="From">
            <input
              aria-label="Available from"
              name="window_start"
              type="datetime-local"
              required
              defaultValue={row.start ? localInput(row.start) : ''}
            />
          </Field>
          <Field label="To">
            <input
              aria-label="Available until"
              name="window_end"
              type="datetime-local"
              required
              defaultValue={row.end ? localInput(row.end) : ''}
            />
          </Field>
          <button
            type="button"
            className="icon-button"
            onClick={() => setRows(rows.filter((r) => r.key !== row.key))}
            aria-label="Remove availability window"
          >
            <Trash2 size={18} />
          </button>
        </div>
      ))}
      <button type="button" className="text-button" onClick={add}>
        <Plus size={16} />
        Add a time window
      </button>
    </div>
  );
}
function readWindows(data: FormData) {
  const ends = data.getAll('window_end');
  return data
    .getAll('window_start')
    .map((value, i) => ({ start: toISO(value), end: toISO(ends[i] ?? null) }));
}
export function RequestTopicsForm({
  requestId,
  api,
  done,
  close,
}: {
  requestId: string;
  api: Api;
  done: (request: ServiceRequest) => Promise<void>;
  close: () => void;
}) {
  const [request, setRequest] = useState<ServiceRequest>();
  const [error, setError] = useState('');
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let active = true;
    setRequest(undefined);
    setError('');
    api<ServiceRequest>(`/requests/${requestId}`)
      .then((value) => {
        if (active) setRequest(value);
      })
      .catch((e: Error) => {
        if (active) setError(e.message);
      });
    return () => {
      active = false;
    };
  }, [api, requestId, attempt]);

  if (error)
    return (
      <div>
        <ErrorNotice message={error} />
        <button
          className="button secondary"
          onClick={() => setAttempt((value) => value + 1)}
        >
          Try again
        </button>
      </div>
    );
  if (!request) return <Loading text="Loading your saved topics…" />;
  if (!['open', 'matched'].includes(request.status))
    return (
      <div className="quiet-panel">
        <p>
          This request is already{' '}
          {request.status === 'accepted' ? 'booked' : request.status}. Topics
          can be edited while a request is open or finding a volunteer.
        </p>
        <button className="button secondary" onClick={close}>
          Back to your requests
        </button>
      </div>
    );
  return (
    <ActionForm
      key={request.id}
      button="Save topics & refresh matches"
      cancel={close}
      submit={async (data) => {
        const saved = await api<ServiceRequest>(
          `/requests/${request.id}`,
          {
            topic_tags: readInterests(data, 'topics', true),
            industry_tags: readInterests(data, 'industries'),
          },
          'PATCH',
        );
        await done(saved);
        close();
      }}
    >
      <div className="request-edit-intro">
        <strong>{request.title}</strong>
        <p>
          Add or remove topics below. Saving refreshes your matches and notifies
          volunteers with matching interests.
        </p>
      </div>
      <InterestSelect
        name="topics"
        title="Topics"
        choices={TOPICS}
        initial={request.topic_tags}
        required
      />
      <InterestSelect
        name="industries"
        title="Industries"
        choices={INDUSTRIES}
        initial={request.industry_tags}
      />
    </ActionForm>
  );
}
export function RequestForm({
  type,
  existing,
  me,
  api,
  done,
  close,
}: {
  type: ParticipantService;
  existing?: ServiceRequest;
  me: Profile;
  api: Api;
  done: () => Promise<void>;
  close: () => void;
}) {
  const [mode, setMode] = useState(
    existing?.preferred_mode ??
      (type === 'teach_me_something' ? 'live_online' : 'async'),
  );
  const s = services[type];
  const p = me.profile && 'topic_interests' in me.profile ? me.profile : null;
  return (
    <ActionForm
      button={existing ? 'Save request' : 'Create request'}
      cancel={close}
      submit={async (d) => {
        const windows = readWindows(d);
        if (mode !== 'async' && mode !== 'either' && !windows.length)
          throw new Error('Add a time window for your live session.');
        const body = {
          ...(!existing ? { service_type: type } : {}),
          title: d.get('title'),
          details: d.get('details'),
          topic_tags: readInterests(d, 'topics', true),
          industry_tags: readInterests(d, 'industries'),
          duration_minutes: Number(d.get('duration')),
          preferred_mode: mode,
          availability_windows: windows,
          access_preferences: d.getAll('access'),
          deadline: d.get('deadline') ? toISO(d.get('deadline')) : null,
          ...(type === 'teach_me_something'
            ? {
                prior_knowledge: d.get('prior'),
                desired_outcome: d.get('outcome'),
              }
            : {}),
          ...(type === 'review_my_work'
            ? {
                artifact_text: d.get('artifact') || null,
                artifact_url: d.get('url') || null,
                review_goal: d.get('goal'),
              }
            : {}),
        };
        const validated = requestSchema.safeParse({
          ...body,
          service_type: type,
        });
        if (!validated.success)
          throw new Error(
            validated.error.issues.map((issue) => issue.message).join('; '),
          );
        if (body.deadline && Date.parse(body.deadline) <= Date.now())
          throw new Error('Choose a deadline in the future.');
        if (windows.some((window) => Date.parse(window.start) <= Date.now()))
          throw new Error('Choose availability that starts in the future.');
        await api(
          existing ? `/requests/${existing.id}` : '/requests',
          body,
          existing ? 'PATCH' : 'POST',
        );
        await done();
        close();
      }}
    >
      <div className={`form-intro ${s.color}`}>
        <s.icon size={22} />
        <span>
          <strong>{s.title}</strong>
          <small>{s.time} of focused, practical support</small>
        </span>
      </div>
      <Field label="Give your request a title">
        <input
          name="title"
          required
          maxLength={160}
          placeholder={
            type === 'review_my_work'
              ? 'A second pair of eyes on my portfolio'
              : type === 'teach_me_something'
                ? 'Help me understand my first Python loop'
                : 'Where do I start with a career in technology?'
          }
          defaultValue={existing?.title}
        />
      </Field>
      <Field
        label="What would you like help with?"
        hint="A little context helps your volunteer prepare."
      >
        <textarea
          name="details"
          required
          rows={3}
          maxLength={4000}
          placeholder="Tell us where you are and what you’re curious about…"
          defaultValue={existing?.details}
        />
      </Field>
      {type === 'teach_me_something' && (
        <>
          <Field label="What do you already know?">
            <textarea
              name="prior"
              rows={2}
              required
              defaultValue={existing?.prior_knowledge ?? ''}
            />
          </Field>
          <Field label="What would you like to be able to do?">
            <textarea
              name="outcome"
              rows={2}
              required
              defaultValue={existing?.desired_outcome ?? ''}
            />
          </Field>
        </>
      )}
      {type === 'review_my_work' && (
        <>
          <Field label="What should your volunteer focus on?">
            <input
              name="goal"
              required
              defaultValue={existing?.review_goal ?? ''}
            />
          </Field>
          <Field
            label="Paste your work"
            hint="Include your text here, or share a link below."
          >
            <textarea
              name="artifact"
              rows={4}
              maxLength={30000}
              defaultValue={existing?.artifact_text ?? ''}
            />
          </Field>
          <Field label="Link to your work (optional)">
            <input
              name="url"
              type="url"
              placeholder="https://…"
              defaultValue={existing?.artifact_url ?? ''}
            />
          </Field>
        </>
      )}
      <div className="form-grid">
        <InterestSelect
          name="topics"
          title="Topics"
          choices={TOPICS}
          initial={existing?.topic_tags ?? p?.topic_interests}
          required
        />
        <InterestSelect
          name="industries"
          title="Industries"
          choices={INDUSTRIES}
          initial={existing?.industry_tags ?? p?.industry_interests}
        />
      </div>
      <div className="form-grid">
        <Field label="How would you like to connect?">
          <select
            value={mode}
            onChange={(e) => setMode(e.target.value as typeof mode)}
          >
            {INTERACTION_MODES.filter(
              (m) =>
                type !== 'teach_me_something' ||
                ['live_online', 'in_person'].includes(m),
            ).map((m) => (
              <option value={m} key={m}>
                {modeLabel(m)}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Time together">
          <select
            name="duration"
            defaultValue={existing?.duration_minutes ?? s.duration}
          >
            {(type === 'teach_me_something'
              ? [20, 25, 30]
              : type === 'review_my_work'
                ? [10, 15]
                : [5, 10]
            ).map((m) => (
              <option value={m} key={m}>
                {m} minutes
              </option>
            ))}
          </select>
        </Field>
      </div>
      {mode !== 'async' && (
        <WindowFields initial={existing?.availability_windows} />
      )}
      <Field label="Deadline (optional)" hint="Singapore time (UTC+8).">
        <input
          name="deadline"
          type="datetime-local"
          defaultValue={existing?.deadline ? localInput(existing.deadline) : ''}
        />
      </Field>
      <fieldset className="choice-group">
        <legend>What would make this more comfortable?</legend>
        <p>We’ll look for a volunteer who can support these preferences.</p>
        <Checks
          name="access"
          options={ACCESS_PREFERENCES}
          selected={existing?.access_preferences ?? p?.access_preferences}
        />
      </fieldset>
    </ActionForm>
  );
}
export function OfferForm({
  api,
  existing,
  done,
  close,
}: {
  api: Api;
  existing?: VolunteerOffer;
  done: () => Promise<void>;
  close: () => void;
}) {
  return (
    <ActionForm
      button={existing ? 'Save story' : 'Publish career story'}
      cancel={close}
      submit={async (d) => {
        const start = toISO(d.get('start'));
        const body = {
          title: d.get('title'),
          description: d.get('description'),
          starts_at: start,
          ends_at: new Date(Date.parse(start) + 15 * 60000).toISOString(),
          mode: d.get('mode'),
          capacity: Number(d.get('capacity')),
          industry_tags: tags(d.get('industries')),
          topic_tags: tags(d.get('topics')),
          access_features: d.getAll('access'),
        };
        await api(
          existing ? `/offers/${existing.id}` : '/offers',
          body,
          existing ? 'PATCH' : 'POST',
        );
        await done();
        close();
      }}
    >
      <div className="form-intro butter">
        <services.career_story.icon size={22} />
        <span>
          <strong>Your experience can open a door.</strong>
          <small>A 15-minute conversation about your career journey.</small>
        </span>
      </div>
      <Field label="Story title">
        <input
          name="title"
          required
          maxLength={160}
          placeholder="What I wish I knew before my first design job"
          defaultValue={existing?.title}
        />
      </Field>
      <Field label="What will you share?">
        <textarea
          name="description"
          rows={4}
          required
          defaultValue={existing?.description}
          placeholder="A few experiences, lessons, or turning points you’ll talk about…"
        />
      </Field>
      <div className="form-grid">
        <Field
          label="Starts at"
          hint="Singapore time (UTC+8). Lasts 15 minutes."
        >
          <input
            name="start"
            type="datetime-local"
            required
            defaultValue={existing ? localInput(existing.starts_at) : ''}
          />
        </Field>
        <Field label="Number of seats">
          <input
            name="capacity"
            type="number"
            min={1}
            max={100}
            required
            defaultValue={existing?.total_capacity ?? 3}
          />
        </Field>
      </div>
      <Field label="How will you connect?">
        <select name="mode" defaultValue={existing?.mode ?? 'live_online'}>
          <option value="live_online">Online</option>
          <option value="in_person">In person</option>
        </select>
      </Field>
      <div className="form-grid">
        <Field label="Topics" hint="Separate with commas.">
          <input name="topics" defaultValue={existing?.topic_tags.join(', ')} />
        </Field>
        <Field label="Industries">
          <input
            name="industries"
            defaultValue={existing?.industry_tags.join(', ')}
          />
        </Field>
      </div>
      <fieldset className="choice-group">
        <legend>Support you can provide</legend>
        <Checks
          name="access"
          options={ACCESS_PREFERENCES}
          selected={existing?.access_features}
        />
      </fieldset>
    </ActionForm>
  );
}
export function ProfileForm({
  me,
  api,
  done,
}: {
  me: Profile;
  api: Api;
  done: () => Promise<void>;
}) {
  const p = me.profile;
  const volunteer = p && 'expertise_tags' in p ? p : null;
  const participant = p && 'topic_interests' in p ? p : null;
  return (
    <ActionForm
      submit={async (d) => {
        const common = {
          display_name: d.get('display_name'),
          languages: tags(d.get('languages')),
        };
        const body = volunteer
          ? {
              ...common,
              headline: d.get('headline'),
              organisation: d.get('organisation'),
              expertise_tags: readInterests(d, 'topics'),
              industry_tags: readInterests(d, 'industries'),
              max_weekly_minutes: Number(d.get('capacity')),
              supported_services: d.getAll('services'),
              supported_modes: d.getAll('modes'),
              supported_access_preferences: d.getAll('access'),
              available_windows: readWindows(d),
            }
          : participant
            ? {
                ...common,
                topic_interests: readInterests(d, 'topics'),
                industry_interests: readInterests(d, 'industries'),
                preferred_modes: d.getAll('modes'),
                access_preferences: d.getAll('access'),
                time_constraints: d.get('constraints') || null,
              }
            : { display_name: common.display_name };
        await api(`/profiles/${me.user.id}`, body, 'PATCH');
        await done();
      }}
    >
      <div className="form-grid">
        <Field label="Display name">
          <input
            name="display_name"
            required
            maxLength={160}
            defaultValue={me.user.display_name}
          />
        </Field>
        <Field label="Languages" hint="Separate languages with commas.">
          <input name="languages" defaultValue={p?.languages.join(', ')} />
        </Field>
      </div>
      {volunteer && (
        <div className="form-grid">
          <Field label="Headline">
            <input
              name="headline"
              required
              maxLength={160}
              defaultValue={volunteer.headline}
            />
          </Field>
          <Field label="Organisation">
            <input
              name="organisation"
              required
              maxLength={160}
              defaultValue={volunteer.organisation}
            />
          </Field>
        </div>
      )}
      <div className="form-grid">
        <InterestSelect
          name="topics"
          title={volunteer ? 'Your expertise' : 'Topics you’re interested in'}
          choices={TOPICS}
          initial={volunteer?.expertise_tags ?? participant?.topic_interests}
        />
        <InterestSelect
          name="industries"
          title="Industries"
          choices={INDUSTRIES}
          initial={volunteer?.industry_tags ?? participant?.industry_interests}
        />
      </div>
      <fieldset className="choice-group">
        <legend>Ways to connect</legend>
        <Checks
          name="modes"
          options={
            volunteer
              ? ['async', 'live_online', 'in_person']
              : INTERACTION_MODES
          }
          selected={volunteer?.supported_modes ?? participant?.preferred_modes}
        />
      </fieldset>
      {volunteer && (
        <>
          <fieldset className="choice-group">
            <legend>Ways you can help</legend>
            <Checks
              name="services"
              options={SERVICE_TYPES}
              selected={volunteer.supported_services}
            />
          </fieldset>
          <Field label="Minutes you can volunteer each week">
            <input
              name="capacity"
              type="number"
              min={0}
              max={2400}
              required
              defaultValue={volunteer.max_weekly_minutes}
            />
          </Field>
          <WindowFields initial={volunteer.available_windows} />
        </>
      )}
      <fieldset className="choice-group">
        <legend>
          {volunteer ? 'Support you can provide' : 'Your access preferences'}
        </legend>
        <Checks
          name="access"
          options={ACCESS_PREFERENCES}
          selected={
            volunteer?.supported_access_preferences ??
            participant?.access_preferences
          }
        />
      </fieldset>
      {participant && (
        <Field label="Anything else about your availability?">
          <textarea
            name="constraints"
            rows={3}
            defaultValue={participant.time_constraints ?? ''}
            placeholder="For example, I’m usually free after work."
          />
        </Field>
      )}
    </ActionForm>
  );
}
