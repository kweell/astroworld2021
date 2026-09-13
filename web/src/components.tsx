import {
  useEffect,
  useRef,
  useState,
  type FormEvent,
  type ReactNode,
} from 'react';
import {
  ArrowUpRight,
  Check,
  Clock3,
  LoaderCircle,
  MessageCircle,
  Mic,
  NotebookPen,
  Sprout,
  X,
  type LucideIcon,
} from 'lucide-react';
import { label, type ServiceType } from './api';

export const services: Record<
  ServiceType,
  {
    title: string;
    short: string;
    description: string;
    time: string;
    icon: LucideIcon;
    color: string;
    duration: number;
  }
> = {
  ask_me_anything: {
    title: 'Ask me anything',
    short: 'Ask a question',
    description: 'A fresh perspective on the question on your mind.',
    time: '5–10 min',
    icon: MessageCircle,
    color: 'sage',
    duration: 10,
  },
  teach_me_something: {
    title: 'Teach me something',
    short: 'Learn a skill',
    description: 'Take a small, practical step with someone who knows how.',
    time: '20–30 min',
    icon: Sprout,
    color: 'peach',
    duration: 25,
  },
  review_my_work: {
    title: 'Review my work',
    short: 'Get feedback',
    description: 'Thoughtful feedback to help your work move forward.',
    time: '10–15 min',
    icon: NotebookPen,
    color: 'lavender',
    duration: 15,
  },
  career_story: {
    title: 'Share a career story',
    short: 'Hear a career story',
    description: 'Real experiences. Different paths. A little inspiration.',
    time: '15 min',
    icon: Mic,
    color: 'butter',
    duration: 15,
  },
};
export function ServiceIcon({
  type,
  large = false,
}: {
  type: ServiceType;
  large?: boolean;
}) {
  const service = services[type];
  return (
    <span className={`service-icon ${service.color} ${large ? 'large' : ''}`}>
      <service.icon size={large ? 25 : 20} strokeWidth={1.7} />
    </span>
  );
}
export function Badge({ status }: { status: string }) {
  return (
    <span className={`badge status-${status}`}>
      {status === 'matched'
        ? 'Finding your volunteer'
        : status === 'accepted'
          ? 'Booked'
          : label(status)}
    </span>
  );
}
export function Empty({
  title,
  children,
  action,
}: {
  title: string;
  children: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="empty">
      <span className="empty-icon">
        <Sprout size={28} strokeWidth={1.4} />
      </span>
      <h3>{title}</h3>
      <p>{children}</p>
      {action}
    </div>
  );
}
export function Loading({
  text = 'Getting your space ready…',
}: {
  text?: string;
}) {
  return (
    <div className="loading" role="status">
      <LoaderCircle size={24} className="spin" />
      <span>{text}</span>
    </div>
  );
}
export function ErrorNotice({ message }: { message: string }) {
  return (
    <div className="error-notice" role="alert">
      {message}
    </div>
  );
}
export function Modal({
  title,
  subtitle,
  children,
  close,
}: {
  title: string;
  subtitle?: string;
  children: ReactNode;
  close: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const dialog = ref.current!;
    dialog.showModal();
    const old = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = old;
      dialog.close();
    };
  }, []);
  return (
    <dialog
      ref={ref}
      className="modal"
      aria-labelledby="dialog-title"
      onCancel={close}
      onClick={(e) => {
        if (e.target === ref.current) close();
      }}
    >
      <div className="modal-head">
        <div>
          <span className="eyebrow">MICRO ACCESS</span>
          <h2 id="dialog-title">{title}</h2>
          {subtitle && <p>{subtitle}</p>}
        </div>
        <button
          className="icon-button"
          onClick={close}
          aria-label="Close dialog"
        >
          <X size={22} />
        </button>
      </div>
      <div className="modal-body">{children}</div>
    </dialog>
  );
}
export function Field({
  label: title,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <label className="field">
      <span>{title}</span>
      {children}
      {hint && <small>{hint}</small>}
    </label>
  );
}
export function Checks({
  name,
  options,
  selected = [],
}: {
  name: string;
  options: readonly string[];
  selected?: string[];
}) {
  return (
    <div className="checks">
      {options.map((option) => (
        <label key={option} className="check-option">
          <input
            type="checkbox"
            name={name}
            value={option}
            defaultChecked={selected.includes(option)}
          />
          <span>{label(option)}</span>
        </label>
      ))}
    </div>
  );
}
export function ActionForm({
  children,
  submit,
  button = 'Save changes',
  cancel,
}: {
  children: ReactNode;
  submit: (data: FormData) => Promise<void>;
  button?: string;
  cancel?: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  async function handle(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');
    setBusy(true);
    try {
      await submit(new FormData(event.currentTarget));
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : 'Something went wrong. Please try again.',
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <form onSubmit={handle}>
      <fieldset disabled={busy} className="form-fields">
        {children}
      </fieldset>
      {error && <ErrorNotice message={error} />}
      <div className="form-footer">
        {cancel && (
          <button className="button secondary" type="button" onClick={cancel}>
            Cancel
          </button>
        )}
        <button className="button primary" disabled={busy} type="submit">
          {busy ? (
            <LoaderCircle size={17} className="spin" />
          ) : (
            <Check size={17} />
          )}
          {busy ? 'Saving…' : button}
        </button>
      </div>
    </form>
  );
}
export function ServiceCard({
  type,
  onClick,
}: {
  type: ServiceType;
  onClick: () => void;
}) {
  const s = services[type];
  return (
    <button className={`service-card ${s.color}`} onClick={onClick}>
      <div className="service-card-top">
        <span className="service-card-icon">
          <s.icon size={29} strokeWidth={1.5} />
        </span>
        <ArrowUpRight size={21} />
      </div>
      <h3>{s.short}</h3>
      <p>{s.description}</p>
      <span className="duration">
        <Clock3 size={14} />
        {s.time}
      </span>
    </button>
  );
}
