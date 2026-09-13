import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type {
  Engagement,
  ParticipantProfile,
  User,
  VolunteerProfile,
} from '../../src/core/domain/entities.js';

export type {
  MatchWithReadiness as Match,
  ServiceRequest,
  VolunteerOffer,
} from '../../src/core/domain/entities.js';
export type {
  InteractionMode,
  ParticipantService,
  ServiceType,
  TimeWindow,
} from '../../src/core/domain/types.js';
export type Profile = {
  user: Omit<User, 'email'> & { email?: string | null };
  profile: ParticipantProfile | VolunteerProfile | null;
};
export type Session = Engagement & { feedback_submitted: boolean };
export type UiConfig = {
  demo: boolean;
  identities: Pick<User, 'id' | 'display_name' | 'role'>[];
  supabaseUrl: string | null;
  supabasePublishableKey: string | null;
};
export type RankedOffer = {
  offerId: string;
  volunteerId: string;
  score: number;
  reasons: string[];
};
export type Api = <T>(
  path: string,
  body?: unknown,
  method?: 'GET' | 'POST' | 'PATCH',
) => Promise<T>;

export function makeApi(identity?: string, auth?: SupabaseClient): Api {
  return async <T>(
    path: string,
    body?: unknown,
    method?: string,
  ): Promise<T> => {
    const headers: Record<string, string> = { Accept: 'application/json' };
    if (identity) headers['x-demo-user-id'] = identity;
    if (auth) {
      const { data, error } = await auth.auth.getSession();
      if (error) throw error;
      if (data.session)
        headers.Authorization = `Bearer ${data.session.access_token}`;
    }
    if (body !== undefined) headers['Content-Type'] = 'application/json';
    let response: Response;
    try {
      response = await fetch(`/api${path}`, {
        method: method ?? (body === undefined ? 'GET' : 'POST'),
        headers,
        body: body === undefined ? undefined : JSON.stringify(body),
      });
    } catch {
      throw new Error(
        'We couldn’t reach the server. Check your connection and try again.',
      );
    }
    const result = await response.json().catch(() => null);
    if (!response.ok || result?.error)
      throw new Error(
        result?.error?.message ??
          'The server is unavailable. Please try again.',
      );
    return result.data as T;
  };
}
export function createAuth(config: UiConfig) {
  return !config.demo && config.supabaseUrl && config.supabasePublishableKey
    ? createClient(config.supabaseUrl, config.supabasePublishableKey)
    : undefined;
}
export const tags = (value: FormDataEntryValue | null) =>
  String(value ?? '')
    .split(',')
    .map((v) => v.trim().toLowerCase())
    .filter(Boolean);
export const label = (value: string) =>
  value.replaceAll('_', ' ').replace(/^./, (c) => c.toUpperCase());
export const modeLabel = (value: string) =>
  ({
    async: 'In your own time',
    live_online: 'Online',
    in_person: 'In person',
    either: 'Flexible',
  })[value] ?? label(value);
export const dateLabel = (value: string) =>
  new Intl.DateTimeFormat('en-SG', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'Asia/Singapore',
  }).format(new Date(value));
export const timeLabel = (value: string) =>
  new Intl.DateTimeFormat('en-SG', {
    hour: 'numeric',
    minute: '2-digit',
    timeZone: 'Asia/Singapore',
  }).format(new Date(value));
export const localInput = (value: string) =>
  new Date(Date.parse(value) + 8 * 3600000).toISOString().slice(0, 16);
export const toISO = (value: FormDataEntryValue | null) =>
  new Date(`${String(value)}:00+08:00`).toISOString();
export const initials = (name: string) =>
  name
    .split(' ')
    .filter((word) => word !== 'Demo')
    .map((word) => word[0])
    .slice(0, 2)
    .join('');
