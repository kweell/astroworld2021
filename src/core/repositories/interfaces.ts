import type { Tables } from '../domain/entities.js';
export type Table = keyof Tables;
export interface Repository {
  get<K extends Table>(table: K, id: string): Promise<Tables[K] | null>;
  list<K extends Table>(
    table: K,
    where?: Partial<Tables[K]>,
  ): Promise<Tables[K][]>;
  insert<K extends Table>(table: K, row: Tables[K]): Promise<Tables[K]>;
  update<K extends Table>(
    table: K,
    id: string,
    changes: Partial<Tables[K]>,
  ): Promise<Tables[K]>;
}
export interface Database extends Repository {
  // All state-changing services use a single atomic unit of work.
  transaction<T>(work: (repository: Repository) => Promise<T>): Promise<T>;
  close(): Promise<void>;
}
export interface SqlExecutor {
  exec(sql: string): Promise<void>;
  query<T extends Record<string, unknown>>(
    sql: string,
    parameters?: unknown[],
  ): Promise<{ rows: T[] }>;
}
export interface SqlDatabase extends SqlExecutor {
  transaction<T>(work: (sql: SqlExecutor) => Promise<T>): Promise<T>;
  close(): Promise<void>;
}
