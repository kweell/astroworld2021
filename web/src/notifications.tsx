import { useEffect, useRef, useState } from 'react';
import { Bell, Check, ChevronRight } from 'lucide-react';
import type { NotificationItem as Notification } from '../../src/core/domain/entities.js';
import { type Api, type ServiceRequest, label } from './api';
import { ErrorNotice, ServiceIcon } from './components';

export function NotificationBell({
  api,
  onOpen,
  onUpdate,
}: {
  api: Api;
  onOpen: (request: ServiceRequest) => void;
  onUpdate: () => void;
}) {
  const [items, setItems] = useState<Notification[]>([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [opening, setOpening] = useState<string | null>(null);
  const container = useRef<HTMLDetailsElement>(null);
  const updateRef = useRef(onUpdate);
  useEffect(() => {
    updateRef.current = onUpdate;
  }, [onUpdate]);
  useEffect(() => {
    let active = true;
    let pending = false;
    let previous: string | null = null;
    async function poll() {
      if (pending || document.visibilityState === 'hidden') return;
      pending = true;
      try {
        const next = await api<Notification[]>('/notifications');
        if (!active) return;
        const signature = next
          .map((item) => `${item.id}:${item.match_id}:${item.read_at ?? ''}`)
          .join('|');
        setItems(next);
        setError('');
        if (previous !== null && signature !== previous) updateRef.current();
        previous = signature;
      } catch (e) {
        if (active) setError((e as Error).message);
      } finally {
        pending = false;
        if (active) setLoading(false);
      }
    }
    void poll();
    const timer = window.setInterval(() => void poll(), 5000);
    const focus = () => void poll();
    window.addEventListener('focus', focus);
    document.addEventListener('visibilitychange', focus);
    const dismiss = (event: PointerEvent) => {
      if (
        container.current &&
        !container.current.contains(event.target as Node)
      )
        container.current.open = false;
    };
    const escape = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && container.current?.open) {
        container.current.open = false;
        container.current.querySelector('summary')?.focus();
      }
    };
    document.addEventListener('pointerdown', dismiss);
    document.addEventListener('keydown', escape);
    return () => {
      active = false;
      clearInterval(timer);
      window.removeEventListener('focus', focus);
      document.removeEventListener('visibilitychange', focus);
      document.removeEventListener('pointerdown', dismiss);
      document.removeEventListener('keydown', escape);
    };
  }, [api]);
  const unread = items.filter((item) => !item.read_at).length;
  async function open(item: Notification) {
    setOpening(item.id);
    setError('');
    try {
      const request = await api<ServiceRequest>(`/requests/${item.request_id}`);
      await api(`/notifications/${item.id}`, { read: true }, 'PATCH');
      setItems((values) =>
        values.map((value) =>
          value.id === item.id
            ? { ...value, read_at: new Date().toISOString() }
            : value,
        ),
      );
      if (container.current) container.current.open = false;
      onOpen(request);
      updateRef.current();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setOpening(null);
    }
  }
  return (
    <details className="notification-bell" ref={container}>
      <summary aria-label={`Notifications: ${unread} unread requests`}>
        <Bell size={21} />
        {unread > 0 && (
          <span className="notification-count">
            {unread > 99 ? '99+' : unread}
          </span>
        )}
        {error && (
          <span
            className="notification-warning"
            aria-label="Notifications unavailable"
          >
            !
          </span>
        )}
      </summary>
      <section
        className="notification-panel"
        aria-label="Volunteer notifications"
      >
        <header>
          <div>
            <h2>Open requests</h2>
            <p>New opportunities that match your topics.</p>
          </div>
          <span className="badge">{unread} unread</span>
        </header>
        {error && <ErrorNotice message={error} />}
        {loading ? (
          <p className="notification-empty" role="status">
            Checking for requests…
          </p>
        ) : !items.length ? (
          <p className="notification-empty">
            No open requests match your topics yet. Update your expertise in My
            profile to help students find you.
          </p>
        ) : (
          <ul>
            {items.map((item) => (
              <li key={item.id}>
                <button
                  disabled={opening !== null}
                  className={item.read_at ? '' : 'unread'}
                  onClick={() => void open(item)}
                >
                  <ServiceIcon type={item.service_type} />
                  <span className="notification-copy">
                    <strong>{item.request_title}</strong>
                    <span>
                      {item.matching_topics.map(label).join(', ')} ·{' '}
                      {item.duration_minutes} min
                    </span>
                    <small>
                      {item.read_at ? (
                        <>
                          <Check size={12} /> Read
                        </>
                      ) : (
                        'New request'
                      )}{' '}
                      · Open to view and accept
                    </small>
                  </span>
                  <ChevronRight size={16} />
                </button>
              </li>
            ))}
          </ul>
        )}
        <footer>Updates automatically every 5 seconds.</footer>
      </section>
      <span className="sr-only" role="status" aria-live="polite">
        {loading ? '' : `${unread} unread matching requests`}
      </span>
    </details>
  );
}
