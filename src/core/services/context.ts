import { randomUUID } from 'node:crypto';
import type { Database } from '../repositories/interfaces.js';
export interface Context {
  db: Database;
  now: () => Date;
  id: () => string;
}
export const createContext = (
  db: Database,
  options: Partial<Pick<Context, 'now' | 'id'>> = {},
): Context => ({ db, now: () => new Date(), id: randomUUID, ...options });
export const timestamps = (ctx: Context) => ({
  created_at: ctx.now().toISOString(),
  updated_at: ctx.now().toISOString(),
});
