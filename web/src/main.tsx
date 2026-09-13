import { StrictMode, useEffect, useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';
import {
  ArrowDownUp,
  ArrowRight,
  CalendarDays,
  Check,
  ChevronDown,
  ChevronRight,
  CircleHelp,
  Compass,
  Leaf,
  LogOut,
  Menu,
  Pencil,
  Plus,
  Search,
  Settings2,
  ShieldCheck,
  Sparkles,
  Users,
  X,
  ClipboardList,
  Clock3,
} from 'lucide-react';
import {
  type Api,
  type Profile,
  type RankedOffer,
  type ServiceRequest,
  type Session,
  type UiConfig,
  type VolunteerOffer,
  type ParticipantService,
  createAuth,
  dateLabel,
  initials,
  label,
  makeApi,
  modeLabel,
  timeLabel,
} from './api';
import {
  ActionForm,
  Badge,
  Empty,
  ErrorNotice,
  Field,
  Loading,
  Modal,
  ServiceCard,
  ServiceIcon,
  services,
} from './components';
import {
  OfferForm,
  ProfileForm,
  RequestForm,
  RequestTopicsForm,
} from './forms';
import { OfferDetail, Person, RequestDetail, SessionDetail } from './details';
import { NotificationBell } from './notifications';
import './styles.css';

type Page = 'discover' | 'requests' | 'sessions' | 'profile';
type Dialog =
  | {
      kind: 'create-request';
      type: ParticipantService;
      existing?: ServiceRequest;
    }
  | { kind: 'create-offer'; existing?: VolunteerOffer }
  | { kind: 'request'; item: ServiceRequest }
  | { kind: 'edit-topics'; item: ServiceRequest }
  | { kind: 'offer'; item: VolunteerOffer }
  | { kind: 'session'; item: Session }
  | { kind: 'help' };
type Data = {
  me: Profile;
  requests: ServiceRequest[];
  offers: VolunteerOffer[];
  sessions: Session[];
  profiles: Record<string, Profile>;
  ranked: RankedOffer[];
};

function App() {
  const [config, setConfig] = useState<UiConfig>();
  const [error, setError] = useState('');
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let active = true;
    setError('');
    makeApi()<UiConfig>('/ui-config')
      .then((c) => {
        if (active) setConfig(c);
      })
      .catch((e: Error) => {
        if (active) setError(e.message);
      });
    return () => {
      active = false;
    };
  }, [attempt]);
  if (!config)
    return (
      <div className="startup">
        <Brand />
        {error ? (
          <>
            <ErrorNotice message={error} />
            <button
              className="button primary"
              onClick={() => setAttempt(attempt + 1)}
            >
              Try again
            </button>
            <p className="muted">
              Start the app and API together with <code>npm run dev</code>.
            </p>
          </>
        ) : (
          <Loading />
        )}
      </div>
    );
  return <ConnectedApp config={config} />;
}
function ConnectedApp({ config }: { config: UiConfig }) {
  const [identity, setIdentity] = useState(() => {
    const saved = localStorage.getItem('micro-access-identity');
    return (
      config.identities.find((i) => i.id === saved)?.id ??
      config.identities[0]?.id ??
      ''
    );
  });
  const auth = useMemo(() => createAuth(config), [config]);
  const [authUser, setAuthUser] = useState<string | null>(null);
  const [authLoading, setAuthLoading] = useState(!!auth);
  useEffect(() => {
    if (!auth) return;
    let active = true;
    auth.auth.getSession().then(({ data }) => {
      if (active) {
        setAuthUser(data.session?.user.id ?? null);
        setAuthLoading(false);
      }
    });
    const { data } = auth.auth.onAuthStateChange((_event, session) => {
      if (active) {
        setAuthUser(session?.user.id ?? null);
        setAuthLoading(false);
      }
    });
    return () => {
      active = false;
      data.subscription.unsubscribe();
    };
  }, [auth]);
  const api = useMemo(
    () => makeApi(config.demo ? identity : undefined, auth),
    [identity, auth, config.demo],
  );
  if (authLoading)
    return (
      <div className="startup">
        <Brand />
        <Loading />
      </div>
    );
  if (!config.demo && !authUser)
    return (
      <div className="login-page">
        <div className="login-story">
          <Brand />
          <span className="eyebrow">
            SMALL CONVERSATIONS. MEANINGFUL PROGRESS.
          </span>
          <h1>
            Someone’s experience.
            <br />
            <em>Your next step.</em>
          </h1>
          <p>
            Connect with people who have something to share. A question, a
            skill, a new perspective — start small.
          </p>
        </div>
        <div className="login-form">
          <span className="eyebrow">WELCOME BACK</span>
          <h2>Your space to grow.</h2>
          {auth ? (
            <ActionForm
              button="Sign in"
              submit={async (d) => {
                const { error } = await auth.auth.signInWithPassword({
                  email: String(d.get('email')),
                  password: String(d.get('password')),
                });
                if (error) throw error;
              }}
            >
              <Field label="Email">
                <input
                  name="email"
                  type="email"
                  required
                  autoComplete="username"
                />
              </Field>
              <Field label="Password">
                <input
                  name="password"
                  type="password"
                  required
                  autoComplete="current-password"
                />
              </Field>
              <p className="muted">
                Use your provisioned platform account. Contact your project
                administrator if you need access.
              </p>
            </ActionForm>
          ) : (
            <ErrorNotice message="Sign-in is not configured yet. Add SUPABASE_PUBLISHABLE_KEY to the server environment and restart the app. Use the public publishable key, never the service role key." />
          )}
        </div>
      </div>
    );
  if (config.demo && !identity)
    return (
      <div className="startup">
        <Brand />
        <Empty title="Your demo is almost ready">
          Run <code>npm run db:migrate</code> and <code>npm run db:seed</code>,
          then reload this page.
        </Empty>
      </div>
    );
  return (
    <Workspace
      key={config.demo ? identity : authUser}
      config={config}
      identity={identity}
      api={api}
      changeIdentity={(id) => {
        localStorage.setItem('micro-access-identity', id);
        setIdentity(id);
      }}
      signOut={async () => {
        if (auth) {
          const { error } = await auth.auth.signOut();
          if (error) throw error;
        }
      }}
    />
  );
}
function Brand() {
  return (
    <div className="brand">
      <span className="brand-symbol" aria-hidden="true">
        <span />
        <span />
        <span />
        <span />
      </span>
      <span>
        micro<span className="brand-light">access</span>
        <small>A LITTLE TIME. A WORLD OF POSSIBILITY.</small>
      </span>
    </div>
  );
}
function Workspace({
  config,
  identity,
  api,
  changeIdentity,
  signOut,
}: {
  config: UiConfig;
  identity: string;
  api: Api;
  changeIdentity: (id: string) => void;
  signOut: () => Promise<void>;
}) {
  const [data, setData] = useState<Data>();
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [notice, setNotice] = useState('');
  const initialPage = window.location.hash.slice(1);
  const [page, setPage] = useState<Page>(
    (['discover', 'requests', 'sessions', 'profile'].includes(initialPage)
      ? initialPage
      : 'discover') as Page,
  );
  const [dialog, setDialog] = useState<Dialog | null>(null);
  const [menu, setMenu] = useState(false);
  const [query, setQuery] = useState('');
  const [mode, setMode] = useState('all');
  const [sort, setSort] = useState('recommended');
  const [filter, setFilter] = useState('all');
  const [rankError, setRankError] = useState('');
  async function load() {
    const [me, requests, offers, sessions] = await Promise.all([
      api<Profile>('/me'),
      api<ServiceRequest[]>('/requests'),
      api<VolunteerOffer[]>('/offers'),
      api<Session[]>('/engagements'),
    ]);
    const ids = [
      ...new Set([
        ...offers.map((o) => o.volunteer_id),
        ...sessions.flatMap((s) => [s.participant_id, s.volunteer_id]),
        ...requests.map((r) => r.participant_id),
      ]),
    ];
    const people = await Promise.all(
      ids.map((id) => api<Profile>(`/profiles/${id}`)),
    );
    let ranked: RankedOffer[] = [];
    if (me.user.role === 'participant') {
      try {
        ranked = await api<RankedOffer[]>('/offers/rank', { limit: 50 });
        setRankError('');
      } catch {
        setRankError(
          'Personalised recommendations are unavailable. You can still browse all career stories.',
        );
      }
    }
    return {
      me,
      requests,
      offers,
      sessions,
      ranked,
      profiles: Object.fromEntries(people.map((p) => [p.user.id, p])),
    };
  }
  useEffect(() => {
    let active = true;
    load()
      .then((value) => {
        if (active) {
          setData(value);
          setError('');
        }
      })
      .catch((e: Error) => {
        if (active) setError(e.message);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [api]);
  useEffect(() => {
    const handler = () => {
      const value = window.location.hash.slice(1);
      if (['discover', 'requests', 'sessions', 'profile'].includes(value))
        setPage(value as Page);
    };
    window.addEventListener('hashchange', handler);
    return () => window.removeEventListener('hashchange', handler);
  }, []);
  useEffect(() => {
    if (!notice) return;
    const timer = window.setTimeout(() => setNotice(''), 5500);
    return () => window.clearTimeout(timer);
  }, [notice]);
  async function refresh(message = '') {
    setRefreshing(true);
    try {
      setData(await load());
      setError('');
      if (message) setNotice(message);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setRefreshing(false);
    }
  }
  function navigate(value: Page) {
    setPage(value);
    window.location.hash = value;
    setMenu(false);
    setFilter('all');
    setQuery('');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }
  const volunteer = data?.me.user.role === 'volunteer';
  const navigation = [
    {
      id: 'discover',
      title: volunteer ? 'Overview' : 'Discover',
      icon: Compass,
    },
    {
      id: 'requests',
      title: volunteer ? 'Matched requests' : 'My requests',
      icon: ClipboardList,
    },
    { id: 'sessions', title: 'My sessions', icon: CalendarDays },
    { id: 'profile', title: 'My profile', icon: Settings2 },
  ] as const;
  const activeRequests =
    data?.requests.filter((r) => ['open', 'matched'].includes(r.status)) ?? [];
  const upcoming =
    data?.sessions
      .filter((s) => s.status === 'confirmed')
      .sort((a, b) =>
        (a.scheduled_start ?? '').localeCompare(b.scheduled_start ?? ''),
      ) ?? [];
  const completed =
    data?.sessions.filter((s) => s.status === 'completed') ?? [];
  const visibleOffers = (data?.offers ?? [])
    .filter((o) =>
      volunteer
        ? o.volunteer_id === data?.me.user.id
        : ['open', 'full'].includes(o.status),
    )
    .filter(
      (o) =>
        (mode === 'all' || o.mode === mode) &&
        [o.title, o.description, ...o.industry_tags, ...o.topic_tags]
          .join(' ')
          .toLowerCase()
          .includes(query.toLowerCase()),
    )
    .sort((a, b) =>
      sort === 'soonest'
        ? a.starts_at.localeCompare(b.starts_at)
        : (data?.ranked.find((r) => r.offerId === b.id)?.score ?? -1) -
            (data?.ranked.find((r) => r.offerId === a.id)?.score ?? -1) ||
          a.starts_at.localeCompare(b.starts_at),
    );
  const title = navigation.find((n) => n.id === page)!.title;
  const openRequest = (request: ServiceRequest) =>
    setDialog({ kind: 'request', item: request });
  const editTopics = (request: ServiceRequest) =>
    setDialog({ kind: 'edit-topics', item: request });
  const openSession = (session: Session) =>
    setDialog({ kind: 'session', item: session });
  const close = () => setDialog(null);
  const afterChange = () => refresh('Your changes have been saved.');
  const persona = data?.me.user.display_name ?? 'Your workspace';
  return (
    <div className="app-shell">
      <a className="skip-link" href="#main">
        Skip to content
      </a>
      {menu && (
        <button
          className="sidebar-backdrop"
          onClick={() => setMenu(false)}
          aria-label="Close navigation"
        />
      )}
      <aside className={`sidebar ${menu ? 'open' : ''}`}>
        <div className="sidebar-brand">
          <Brand />
          <button
            className="icon-button mobile-close"
            aria-label="Close navigation"
            onClick={() => setMenu(false)}
          >
            <X />
          </button>
        </div>
        <div className="workspace-label">
          {volunteer ? 'VOLUNTEER SPACE' : 'YOUR LEARNING SPACE'}
        </div>
        <nav aria-label="Main navigation">
          {navigation.map((item) => (
            <button
              key={item.id}
              className={`nav-item ${page === item.id ? 'active' : ''}`}
              aria-current={page === item.id ? 'page' : undefined}
              onClick={() => navigate(item.id)}
            >
              <item.icon size={20} strokeWidth={1.65} />
              <span>{item.title}</span>
              {item.id === 'requests' && activeRequests.length > 0 && (
                <span className="nav-count">{activeRequests.length}</span>
              )}
            </button>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="sidebar-note">
            <Leaf size={25} strokeWidth={1.4} />
            <h3>Small steps count.</h3>
            <p>
              {volunteer
                ? 'A little of your time can make a meaningful difference.'
                : 'You don’t need to have it all figured out to start.'}
            </p>
          </div>
          <button
            className="help-link"
            onClick={() => setDialog({ kind: 'help' })}
          >
            <CircleHelp size={18} />
            How Micro Access works
            <ArrowRight size={16} />
          </button>
          <div className="sidebar-footer">A community built on sharing.</div>
        </div>
      </aside>
      <div className="main-shell">
        <header className="topbar">
          <div className="breadcrumb">
            <button
              className="icon-button menu-toggle"
              aria-label="Open navigation"
              onClick={() => setMenu(true)}
            >
              <Menu />
            </button>
            <span>My workspace</span>
            <ChevronRight size={15} />
            <strong>{title}</strong>
          </div>
          <div className="topbar-actions">
            {volunteer && (
              <NotificationBell
                api={api}
                onOpen={openRequest}
                onUpdate={() => void refresh()}
              />
            )}
            <span className="workspace-status">
              <span />
              {config.demo ? 'Demo workspace' : 'Your workspace'}
            </span>
            {config.demo ? (
              <label className="identity-control">
                <span className="avatar small">{initials(persona)}</span>
                <select
                  aria-label="Switch demo account"
                  value={identity}
                  onChange={(e) => changeIdentity(e.target.value)}
                >
                  {['participant', 'volunteer'].map((role) => (
                    <optgroup label={label(role) + 's'} key={role}>
                      {config.identities
                        .filter((i) => i.role === role)
                        .map((i) => (
                          <option key={i.id} value={i.id}>
                            {i.display_name}
                          </option>
                        ))}
                    </optgroup>
                  ))}
                </select>
                <ChevronDown size={15} />
              </label>
            ) : (
              <>
                <button
                  className="icon-button"
                  onClick={() => navigate('profile')}
                  aria-label="Your profile"
                >
                  <span className="avatar small">{initials(persona)}</span>
                </button>
                <button
                  className="icon-button"
                  aria-label="Sign out"
                  onClick={() =>
                    void signOut().catch((e: Error) => setError(e.message))
                  }
                >
                  <LogOut size={18} />
                </button>
              </>
            )}
          </div>
        </header>
        <main id="main" tabIndex={-1}>
          {notice && (
            <div className="toast" role="status">
              <Check size={18} />
              {notice}
              <button
                className="icon-button"
                aria-label="Dismiss notification"
                onClick={() => setNotice('')}
              >
                <X size={16} />
              </button>
            </div>
          )}
          {error && (
            <div className="page-error">
              <ErrorNotice message={error} />
              <button
                className="text-button"
                disabled={refreshing}
                onClick={() => void refresh()}
              >
                Try again
              </button>
            </div>
          )}
          {loading ? (
            <Loading />
          ) : (
            data && (
              <>
                {page === 'discover' && (
                  <>
                    <div className="page-heading">
                      <div>
                        <div className="eyebrow">
                          {volunteer
                            ? 'THANK YOU FOR SHOWING UP'
                            : 'A LITTLE CURIOSITY GOES A LONG WAY'}
                        </div>
                        <h1>
                          {volunteer ? (
                            <>
                              Your experience.
                              <br />
                              <em>Someone’s next step.</em>
                            </>
                          ) : (
                            <>
                              Big possibilities.
                              <br />
                              <em>Small beginnings.</em>
                            </>
                          )}
                        </h1>
                        <p>
                          {volunteer
                            ? 'Share what you know, in the time you have.'
                            : 'A question, a new skill, a fresh perspective. What’s your next step?'}
                        </p>
                      </div>
                      <div className="today">
                        <span>YOUR WORKSPACE</span>
                        <strong>{dateLabel(new Date().toISOString())}</strong>
                        <small>All session times in Singapore time</small>
                      </div>
                    </div>
                    <div className="overview-grid">
                      <div className="overview-main">
                        {!volunteer ? (
                          <>
                            <div className="section-heading">
                              <h2>Find a little support</h2>
                              <span className="muted small-text">
                                Made to fit your day
                              </span>
                            </div>
                            <div className="service-grid">
                              {(
                                Object.keys(
                                  services,
                                ) as (keyof typeof services)[]
                              ).map((type) => (
                                <ServiceCard
                                  type={type}
                                  key={type}
                                  onClick={() =>
                                    type === 'career_story'
                                      ? document
                                          .getElementById('career-stories')
                                          ?.scrollIntoView({
                                            behavior: 'smooth',
                                            block: 'start',
                                          })
                                      : setDialog({
                                          kind: 'create-request',
                                          type,
                                        })
                                  }
                                />
                              ))}
                            </div>
                          </>
                        ) : (
                          <div className="volunteer-welcome">
                            <span className="eyebrow">
                              YOUR NEXT CONVERSATION
                            </span>
                            <h2>A story only you can tell.</h2>
                            <p>
                              Share a few lessons from your career in a
                              15-minute conversation. Someone could be right
                              where you once were.
                            </p>
                            <button
                              className="button primary"
                              onClick={() =>
                                setDialog({ kind: 'create-offer' })
                              }
                            >
                              <Plus size={17} />
                              Offer a career story
                            </button>
                          </div>
                        )}
                        <div className="activity-panel">
                          <div className="section-heading">
                            <h2>
                              {volunteer
                                ? 'Requests matched to you'
                                : 'Your next steps'}
                            </h2>
                            <button
                              className="text-button"
                              onClick={() => navigate('requests')}
                            >
                              View all
                              <ArrowRight size={15} />
                            </button>
                          </div>
                          {activeRequests.length ? (
                            activeRequests
                              .slice(0, 3)
                              .map((r) => (
                                <RequestRow
                                  key={r.id}
                                  item={r}
                                  onClick={() => openRequest(r)}
                                  onEdit={
                                    r.participant_id === data.me.user.id
                                      ? () => editTopics(r)
                                      : undefined
                                  }
                                />
                              ))
                          ) : (
                            <Empty
                              title={
                                volunteer
                                  ? 'The right match takes a little care'
                                  : 'Start with something you’re curious about'
                              }
                            >
                              {volunteer
                                ? 'Keep your profile and availability up to date. Requests that match your skills will appear here.'
                                : 'Choose a way to connect above and create your first request.'}
                            </Empty>
                          )}
                        </div>
                      </div>
                      <aside className="right-rail">
                        <div className="glance-card">
                          <div className="section-heading">
                            <h2>At a glance</h2>
                            <Sparkles size={19} />
                          </div>
                          <button
                            className="stat-row"
                            onClick={() => navigate('requests')}
                          >
                            <span>
                              <span className="stat-icon sage">
                                <ClipboardList size={18} />
                              </span>
                              Active requests
                            </span>
                            <strong>{activeRequests.length}</strong>
                          </button>
                          <button
                            className="stat-row"
                            onClick={() => navigate('sessions')}
                          >
                            <span>
                              <span className="stat-icon peach">
                                <CalendarDays size={18} />
                              </span>
                              Confirmed sessions
                            </span>
                            <strong>{upcoming.length}</strong>
                          </button>
                          <button
                            className="stat-row"
                            onClick={() => {
                              navigate('sessions');
                              setFilter('completed');
                            }}
                          >
                            <span>
                              <span className="stat-icon lavender">
                                <Check size={18} />
                              </span>
                              Completed
                            </span>
                            <strong>{completed.length}</strong>
                          </button>
                        </div>
                        {upcoming[0] ? (
                          <div className="next-session">
                            <span className="eyebrow">ON YOUR HORIZON</span>
                            <ServiceIcon type={upcoming[0].service_type} />
                            <h3>{services[upcoming[0].service_type].title}</h3>
                            <p>
                              {upcoming[0].scheduled_start
                                ? `${dateLabel(upcoming[0].scheduled_start)}, ${timeLabel(upcoming[0].scheduled_start)} SGT`
                                : 'A conversation at your own pace'}
                            </p>
                            <button
                              className="text-button"
                              onClick={() => openSession(upcoming[0]!)}
                            >
                              View session
                              <ArrowRight size={15} />
                            </button>
                          </div>
                        ) : (
                          <div className="pace-card">
                            <span className="pace-symbol">
                              <Leaf size={30} strokeWidth={1.4} />
                            </span>
                            <h3>
                              At your pace.
                              <br />
                              In your own way.
                            </h3>
                            <p>
                              Language, format, or a little extra support — tell
                              us what works for you.
                            </p>
                            <button
                              className="text-button"
                              onClick={() => navigate('profile')}
                            >
                              Set your preferences
                              <ArrowRight size={15} />
                            </button>
                          </div>
                        )}
                      </aside>
                    </div>
                    <section id="career-stories" className="stories-section">
                      <div className="section-heading">
                        <div>
                          <span className="eyebrow">
                            {volunteer
                              ? 'MAKE SPACE FOR A CONVERSATION'
                              : 'A WINDOW INTO SOMEONE ELSE’S WORLD'}
                          </span>
                          <h2>
                            {volunteer
                              ? 'Your career stories'
                              : 'Different journeys. Real stories.'}
                          </h2>
                          <p>
                            {volunteer
                              ? 'Manage your stories and the seats available.'
                              : 'Meet a volunteer, hear their experience, and ask what’s on your mind.'}
                          </p>
                        </div>
                        {volunteer && (
                          <button
                            className="button secondary"
                            onClick={() => setDialog({ kind: 'create-offer' })}
                          >
                            <Plus size={16} />
                            New story
                          </button>
                        )}
                      </div>
                      <div className="filter-bar">
                        <div className="segmented" aria-label="Story format">
                          {[
                            ['all', 'All stories'],
                            ['live_online', 'Online'],
                            ['in_person', 'In person'],
                          ].map(([v, text]) => (
                            <button
                              key={v}
                              aria-pressed={mode === v}
                              className={mode === v ? 'selected' : ''}
                              onClick={() => setMode(v!)}
                            >
                              {text}
                            </button>
                          ))}
                        </div>
                        <div className="story-tools">
                          <label className="search-field">
                            <Search size={17} />
                            <input
                              aria-label="Search career stories"
                              value={query}
                              onChange={(e) => setQuery(e.target.value)}
                              placeholder="Search stories…"
                            />
                          </label>
                          <label className="sort-control">
                            <ArrowDownUp size={15} />
                            <select
                              aria-label="Sort career stories"
                              value={sort}
                              onChange={(e) => setSort(e.target.value)}
                            >
                              <option value="recommended">Recommended</option>
                              <option value="soonest">Soonest first</option>
                            </select>
                          </label>
                        </div>
                      </div>
                      {rankError && <p className="muted">{rankError}</p>}
                      {visibleOffers.length ? (
                        <div className="story-grid">
                          {visibleOffers.map((offer, i) => (
                            <StoryCard
                              key={offer.id}
                              offer={offer}
                              host={data.profiles[offer.volunteer_id]}
                              recommendation={data.ranked.find(
                                (r) => r.offerId === offer.id,
                              )}
                              color={['sage', 'lavender', 'peach'][i % 3]!}
                              onClick={() =>
                                setDialog({ kind: 'offer', item: offer })
                              }
                            />
                          ))}
                        </div>
                      ) : (
                        <Empty
                          title={
                            query || mode !== 'all'
                              ? 'No stories match these filters'
                              : 'The next story is still being written'
                          }
                        >
                          {query || mode !== 'all'
                            ? 'Try another topic or view all formats.'
                            : volunteer
                              ? 'Publish a career story to share your experience.'
                              : 'Check back soon for new career conversations.'}
                        </Empty>
                      )}
                    </section>
                    <div className="bottom-note">
                      <ShieldCheck size={17} />
                      <span>
                        Real people. Thoughtful matches. Support that starts
                        with you.
                      </span>
                    </div>
                  </>
                )}
                {page === 'requests' && (
                  <>
                    <PageHeading
                      eyebrow={
                        volunteer
                          ? 'A LITTLE OF YOUR TIME'
                          : 'ONE STEP AT A TIME'
                      }
                      title={
                        volunteer
                          ? 'A chance to help.'
                          : 'Your questions. Your progress.'
                      }
                      description={
                        volunteer
                          ? 'These requests have been matched to your skills and availability.'
                          : 'Create a request or update its topics while you’re finding a volunteer.'
                      }
                      action={
                        !volunteer && (
                          <button
                            className="button primary"
                            onClick={() =>
                              setDialog({
                                kind: 'create-request',
                                type: 'ask_me_anything',
                              })
                            }
                          >
                            <Plus size={17} />
                            New request
                          </button>
                        )
                      }
                    />
                    <div className="list-toolbar">
                      <Filter
                        value={filter}
                        set={setFilter}
                        options={[
                          'all',
                          'open',
                          'matched',
                          'accepted',
                          'completed',
                          'cancelled',
                        ]}
                      />
                      <label className="search-field">
                        <Search size={17} />
                        <input
                          value={query}
                          onChange={(e) => setQuery(e.target.value)}
                          placeholder="Search requests…"
                          aria-label="Search requests"
                        />
                      </label>
                    </div>
                    <div className="request-list">
                      {data.requests
                        .filter(
                          (r) =>
                            (filter === 'all' || r.status === filter) &&
                            `${r.title} ${r.details}`
                              .toLowerCase()
                              .includes(query.toLowerCase()),
                        )
                        .map((r) => (
                          <RequestRow
                            key={r.id}
                            item={r}
                            onClick={() => openRequest(r)}
                            onEdit={
                              r.participant_id === data.me.user.id &&
                              ['open', 'matched'].includes(r.status)
                                ? () => editTopics(r)
                                : undefined
                            }
                          />
                        ))}
                      {!data.requests.some(
                        (r) =>
                          (filter === 'all' || r.status === filter) &&
                          `${r.title} ${r.details}`
                            .toLowerCase()
                            .includes(query.toLowerCase()),
                      ) && (
                        <Empty title="No requests here yet">
                          {volunteer
                            ? 'When a participant generates a match with you, their request will appear here.'
                            : 'Choose a way to connect and take your first small step.'}
                        </Empty>
                      )}
                    </div>
                    {!volunteer && (
                      <div className="request-type-footer">
                        <h3>What kind of support do you need?</h3>
                        <div className="mini-service-grid">
                          {(
                            [
                              'ask_me_anything',
                              'teach_me_something',
                              'review_my_work',
                            ] as const
                          ).map((type) => (
                            <button
                              key={type}
                              className="mini-service"
                              onClick={() =>
                                setDialog({ kind: 'create-request', type })
                              }
                            >
                              <ServiceIcon type={type} />
                              <span>
                                {services[type].short}
                                <small>{services[type].time}</small>
                              </span>
                              <Plus size={18} />
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </>
                )}
                {page === 'sessions' && (
                  <>
                    <PageHeading
                      eyebrow="CONNECTIONS THAT COUNT"
                      title="A little time, together."
                      description="Your confirmed conversations, completed sessions, and next steps."
                    />
                    <Filter
                      value={filter}
                      set={setFilter}
                      options={['all', 'confirmed', 'completed', 'cancelled']}
                    />
                    <div className="session-grid">
                      {data.sessions
                        .filter((s) => filter === 'all' || s.status === filter)
                        .map((session) => (
                          <button
                            className="session-card"
                            key={session.id}
                            onClick={() => openSession(session)}
                          >
                            <div className="section-heading">
                              <ServiceIcon type={session.service_type} />
                              <Badge status={session.status} />
                            </div>
                            <h3>
                              {data.requests.find(
                                (r) => r.id === session.request_id,
                              )?.title ??
                                data.offers.find(
                                  (o) => o.id === session.offer_id,
                                )?.title ??
                                services[session.service_type].title}
                            </h3>
                            <Person
                              profile={
                                data.profiles[
                                  volunteer
                                    ? session.participant_id
                                    : session.volunteer_id
                                ]
                              }
                              compact
                            />
                            <div className="session-time">
                              <CalendarDays size={17} />
                              <span>
                                {session.scheduled_start
                                  ? `${dateLabel(session.scheduled_start)} · ${timeLabel(session.scheduled_start)} SGT`
                                  : 'In your own time'}
                              </span>
                            </div>
                            <div className="card-footer">
                              <span>
                                {session.duration_minutes} min ·{' '}
                                {modeLabel(session.mode)}
                              </span>
                              <ArrowRight size={18} />
                            </div>
                          </button>
                        ))}
                    </div>
                    {!data.sessions.some(
                      (s) => filter === 'all' || s.status === filter,
                    ) && (
                      <Empty title="A little room for something new">
                        Confirmed bookings will appear here.{' '}
                        {volunteer
                          ? 'Accept a matched request to get started.'
                          : 'Book a career story, or create a request and connect with a volunteer.'}
                      </Empty>
                    )}
                  </>
                )}
                {page === 'profile' && (
                  <>
                    <PageHeading
                      eyebrow="A MATCH THAT STARTS WITH YOU"
                      title="Make this space yours."
                      description="A few details help us find the right people, at the right time."
                    />
                    <div className="profile-layout">
                      <section className="profile-form panel">
                        <div className="section-heading">
                          <h2>Your preferences</h2>
                          <span className="role-label">
                            {label(data.me.user.role)}
                          </span>
                        </div>
                        <ProfileForm
                          key={data.me.user.updated_at + data.me.user.id}
                          me={data.me}
                          api={api}
                          done={() => refresh('Your profile has been updated.')}
                        />
                      </section>
                      <aside>
                        <div className="profile-summary">
                          <span className="avatar extra-large">
                            {initials(persona)}
                          </span>
                          <h3>{persona}</h3>
                          <p>{label(data.me.user.role)}</p>
                          {data.me.profile &&
                            'verification_status' in data.me.profile && (
                              <Badge
                                status={data.me.profile.verification_status}
                              />
                            )}
                        </div>
                        <div className="quiet-panel">
                          <ShieldCheck size={23} />
                          <h3>Comfort comes first.</h3>
                          <p>
                            Your access preferences help us find support that
                            fits. Your contact email is shared only with people
                            you have a confirmed or completed session with.
                          </p>
                          {volunteer && (
                            <p>
                              Volunteer verification is managed by your platform
                              administrator.
                            </p>
                          )}
                        </div>
                      </aside>
                    </div>
                  </>
                )}
              </>
            )
          )}
          {!loading && !data && (
            <Empty title="We couldn’t load your workspace">
              Check that your database is available and your account is
              provisioned, then try again.
            </Empty>
          )}
        </main>
      </div>
      {dialog && data && (
        <Modal
          key={
            dialog.kind +
            ('item' in dialog
              ? dialog.item.id
              : dialog.kind === 'create-request'
                ? (dialog.existing?.id ?? dialog.type)
                : dialog.kind === 'create-offer'
                  ? (dialog.existing?.id ?? 'new')
                  : '')
          }
          title={
            dialog.kind === 'create-request'
              ? dialog.existing
                ? 'Refine your request'
                : 'Start with a small step'
              : dialog.kind === 'edit-topics'
                ? 'Update your topics'
                : dialog.kind === 'create-offer'
                  ? dialog.existing
                    ? 'Edit your career story'
                    : 'Share your career story'
                  : dialog.kind === 'request' || dialog.kind === 'offer'
                    ? dialog.item.title
                    : dialog.kind === 'session'
                      ? 'Your session'
                      : 'Small conversations. Meaningful progress.'
          }
          close={close}
        >
          {dialog.kind === 'edit-topics' && (
            <RequestTopicsForm
              requestId={dialog.item.id}
              api={api}
              done={async (request) => {
                setData((current) =>
                  current
                    ? {
                        ...current,
                        requests: current.requests.map((r) =>
                          r.id === request.id ? request : r,
                        ),
                      }
                    : current,
                );
                await refresh('Topics saved. Volunteer matches refreshed.');
              }}
              close={close}
            />
          )}
          {dialog.kind === 'create-request' && (
            <RequestForm
              type={dialog.type}
              existing={dialog.existing}
              me={data.me}
              api={api}
              done={afterChange}
              close={close}
            />
          )}
          {dialog.kind === 'create-offer' && (
            <OfferForm
              api={api}
              existing={dialog.existing}
              done={afterChange}
              close={close}
            />
          )}
          {dialog.kind === 'request' && (
            <RequestDetail
              request={
                data.requests.find((r) => r.id === dialog.item.id) ??
                dialog.item
              }
              api={api}
              me={data.me}
              profiles={data.profiles}
              refresh={() => refresh()}
              close={close}
              editTopics={() => editTopics(dialog.item)}
              edit={() =>
                setDialog({
                  kind: 'create-request',
                  type: dialog.item.service_type,
                  existing:
                    data.requests.find((r) => r.id === dialog.item.id) ??
                    dialog.item,
                })
              }
            />
          )}
          {dialog.kind === 'offer' && (
            <OfferDetail
              offer={
                data.offers.find((o) => o.id === dialog.item.id) ?? dialog.item
              }
              api={api}
              me={data.me}
              host={data.profiles[dialog.item.volunteer_id]}
              sessions={data.sessions}
              done={afterChange}
              close={close}
              edit={() =>
                setDialog({ kind: 'create-offer', existing: dialog.item })
              }
            />
          )}
          {dialog.kind === 'session' && (
            <SessionDetail
              session={
                data.sessions.find((s) => s.id === dialog.item.id) ??
                dialog.item
              }
              api={api}
              counterpart={
                data.profiles[
                  volunteer
                    ? dialog.item.participant_id
                    : dialog.item.volunteer_id
                ]
              }
              done={afterChange}
              close={close}
            />
          )}
          {dialog.kind === 'help' && (
            <div className="help-content">
              <div>
                <span>01</span>
                <h3>Start with what you need</h3>
                <p>
                  Ask a question, learn a skill, get feedback on your work, or
                  book a volunteer’s career story.
                </p>
              </div>
              <div>
                <span>02</span>
                <h3>Find your people</h3>
                <p>
                  Requests automatically find volunteers with overlapping
                  topics. We also check skills, availability, language, and
                  access preferences. A suggested volunteer accepts to confirm a
                  session.
                </p>
              </div>
              <div>
                <span>03</span>
                <h3>Connect, then reflect</h3>
                <p>
                  Coordinate through your agreed contact method. After the
                  session, mark it complete and leave feedback.
                </p>
              </div>
              {config.demo && (
                <div className="quiet-panel">
                  <h3>Exploring the demo</h3>
                  <p>
                    Use the account selector at the top to switch between
                    participants and volunteers. Create a request as a
                    participant, then switch to a matching volunteer and open
                    the notification bell to view and accept the request.
                    Changes are saved to your configured database.
                  </p>
                  <p>
                    Seeded live sessions use 7–8 January 2030. Async requests
                    can be completed immediately.
                  </p>
                </div>
              )}
            </div>
          )}
        </Modal>
      )}
    </div>
  );
}
function PageHeading({
  eyebrow,
  title,
  description,
  action,
}: {
  eyebrow: string;
  title: string;
  description: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="page-heading compact-heading">
      <div>
        <span className="eyebrow">{eyebrow}</span>
        <h1>{title}</h1>
        <p>{description}</p>
      </div>
      {action}
    </div>
  );
}
function Filter({
  value,
  set,
  options,
}: {
  value: string;
  set: (value: string) => void;
  options: string[];
}) {
  return (
    <div className="filter-tabs" aria-label="Filter by status">
      {options.map((option) => (
        <button
          key={option}
          onClick={() => set(option)}
          className={value === option ? 'selected' : ''}
          aria-pressed={value === option}
        >
          {label(option)}
        </button>
      ))}
    </div>
  );
}
function RequestRow({
  item,
  onClick,
  onEdit,
}: {
  item: ServiceRequest;
  onClick: () => void;
  onEdit?: () => void;
}) {
  return (
    <div className="request-entry">
      <button className="request-row" onClick={onClick}>
        <ServiceIcon type={item.service_type} />
        <div className="request-text">
          <h3>{item.title}</h3>
          <span>
            {services[item.service_type].short}
            <span className="dot">·</span>
            {item.duration_minutes} min<span className="dot">·</span>
            {modeLabel(item.preferred_mode)}
          </span>
          <span className="request-topics">
            {item.topic_tags.slice(0, 3).map((topic) => (
              <span key={topic}>{label(topic)}</span>
            ))}
            {item.topic_tags.length > 3 && (
              <span>+{item.topic_tags.length - 3} more</span>
            )}
          </span>
        </div>
        <Badge status={item.status} />
        <ChevronRight size={18} className="row-arrow" />
      </button>
      {onEdit && (
        <button
          className="button secondary small request-edit"
          onClick={onEdit}
          aria-label={`Edit topics for ${item.title}`}
        >
          <Pencil size={14} />
          Edit topics
        </button>
      )}
    </div>
  );
}
function StoryCard({
  offer,
  host,
  recommendation,
  color,
  onClick,
}: {
  offer: VolunteerOffer;
  host?: Profile;
  recommendation?: RankedOffer;
  color: string;
  onClick: () => void;
}) {
  return (
    <article className="story-card">
      <div className={`story-banner ${color}`}>
        <span className="eyebrow">
          {offer.industry_tags[0]
            ? label(offer.industry_tags[0])
            : 'Career journey'}
        </span>
        <services.career_story.icon size={34} strokeWidth={1.25} />
        <span className="story-format">{modeLabel(offer.mode)}</span>
      </div>
      <div className="story-body">
        <div className="story-recommendation">
          {recommendation ? (
            <>
              <Sparkles size={13} />
              {recommendation.reasons[0] ?? 'Matches your interests'}
            </>
          ) : (
            <>
              <Clock3 size={13} />
              15 minutes of shared experience
            </>
          )}
        </div>
        <h3>
          <button onClick={onClick}>{offer.title}</button>
        </h3>
        <p className="story-description">{offer.description}</p>
        <Person profile={host} compact />
        <div className="story-date">
          <CalendarDays size={15} />
          <span>
            {dateLabel(offer.starts_at)} · {timeLabel(offer.starts_at)} SGT
          </span>
        </div>
        <div className="card-footer">
          <span className={offer.capacity ? 'seats' : 'muted'}>
            <Users size={14} />
            {offer.status === 'open' || offer.status === 'full'
              ? `${offer.capacity} ${offer.capacity === 1 ? 'seat' : 'seats'} left`
              : label(offer.status)}
          </span>
          <button className="text-button" onClick={onClick}>
            View story
            <ArrowRight size={16} />
          </button>
        </div>
      </div>
    </article>
  );
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
