import { mkdirSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';
import pg from 'pg';
import type { Config } from '../config.js';
import type { SqlDatabase, SqlExecutor } from '../repositories/interfaces.js';
import { createDatabase } from '../repositories/supabase-repository.js';
export async function createSqlDatabase(config: Config): Promise<SqlDatabase> {
  if (config.DATABASE_MODE === 'local')
    return createLocalSqlDatabase(config.LOCAL_DATABASE_PATH);
  const connectionUrl = new URL(config.SUPABASE_DB_URL!);
  // pg connection-string SSL flags otherwise override the verified TLS options.
  for (const key of [
    'ssl',
    'sslmode',
    'sslrootcert',
    'sslcert',
    'sslkey',
    'uselibpqcompat',
  ])
    connectionUrl.searchParams.delete(key);
  const pool = new pg.Pool({
    connectionString: connectionUrl.toString(),
    max: 5,
    connectionTimeoutMillis: 10000,
    ssl: {
      rejectUnauthorized: true,
      ...(config.SUPABASE_DB_CA_PATH
        ? { ca: await readFile(config.SUPABASE_DB_CA_PATH, 'utf8') }
        : {}),
    },
  });
  return {
    query: (query, parameters) => pool.query(query, parameters),
    exec: async (query) => {
      await pool.query(query);
    },
    transaction: async (work) => {
      const connection = await pool.connect();
      try {
        await connection.query('BEGIN');
        const result = await work({
          query: (query, parameters) => connection.query(query, parameters),
          exec: async (query) => {
            await connection.query(query);
          },
        });
        await connection.query('COMMIT');
        return result;
      } catch (error) {
        await connection.query('ROLLBACK');
        throw error;
      } finally {
        connection.release();
      }
    },
    close: () => pool.end(),
  };
}
export function createLocalSqlDatabase(path?: string): SqlDatabase {
  if (path) mkdirSync(path, { recursive: true });
  const db = new PGlite(path);
  const executor: SqlExecutor = {
    query: (query, parameters) => db.query(query, parameters),
    exec: async (query) => {
      await db.exec(query);
    },
  };
  return {
    ...executor,
    transaction: (work) =>
      db.transaction((tx) =>
        work({
          query: (query, parameters) => tx.query(query, parameters),
          exec: async (query) => {
            await tx.exec(query);
          },
        }),
      ),
    close: () => db.close(),
  };
}
export async function connectDatabase(config: Config) {
  return createDatabase(await createSqlDatabase(config));
}
