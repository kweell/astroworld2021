import type { Tables } from '../domain/entities.js';
import { requireFound } from '../domain/errors.js';
import type {
  Database,
  Repository,
  SqlDatabase,
  SqlExecutor,
  Table,
} from './interfaces.js';
const primaryKey = (table: Table) =>
  table.endsWith('_profiles') ? 'user_id' : 'id';
const jsonColumns = new Set([
  'availability_windows',
  'available_windows',
  'suggested_windows',
]);
const identifier = (name: string) => {
  if (!/^[a-z_]+$/.test(name)) throw new Error('Invalid SQL identifier');
  return `"${name}"`;
};
function encode(column: string, value: unknown): unknown {
  return jsonColumns.has(column) ? JSON.stringify(value) : value;
}
function decode<T>(row: Record<string, unknown>): T {
  return Object.fromEntries(
    Object.entries(row).map(([k, v]) => [
      k,
      v instanceof Date ? v.toISOString() : v,
    ]),
  ) as T;
}
export function createRepository(sql: SqlExecutor): Repository {
  async function list<K extends Table>(
    table: K,
    where: Partial<Tables[K]> = {},
  ): Promise<Tables[K][]> {
    const entries = Object.entries(where);
    const conditions = entries
      .map(([key], i) => `${identifier(key)} IS NOT DISTINCT FROM $${i + 1}`)
      .join(' AND ');
    const result = await sql.query(
      `SELECT * FROM micro_access.${identifier(table)}${conditions ? ` WHERE ${conditions}` : ''} ORDER BY ${primaryKey(table)}`,
      entries.map(([key, value]) => encode(key, value)),
    );
    return result.rows.map((row) => decode<Tables[K]>(row));
  }
  return {
    list,
    async get<K extends Table>(table: K, id: string) {
      return (
        (
          await list(table, { [primaryKey(table)]: id } as Partial<Tables[K]>)
        )[0] ?? null
      );
    },
    async insert<K extends Table>(table: K, row: Tables[K]) {
      const entries = Object.entries(row);
      const result = await sql.query(
        `INSERT INTO micro_access.${identifier(table)} (${entries.map(([key]) => identifier(key)).join(',')}) VALUES (${entries.map((_, i) => `$${i + 1}`).join(',')}) RETURNING *`,
        entries.map(([key, value]) => encode(key, value)),
      );
      return decode<Tables[K]>(requireFound(result.rows[0], table));
    },
    async update<K extends Table>(
      table: K,
      id: string,
      changes: Partial<Tables[K]>,
    ) {
      const entries = Object.entries(changes).filter(
        ([key]) => key !== primaryKey(table),
      );
      if (!entries.length)
        return requireFound(
          (
            await list(table, { [primaryKey(table)]: id } as Partial<Tables[K]>)
          )[0],
          table,
        );
      const result = await sql.query(
        `UPDATE micro_access.${identifier(table)} SET ${entries.map(([key], i) => `${identifier(key)} = $${i + 1}`).join(',')} WHERE ${primaryKey(table)} = $${entries.length + 1} RETURNING *`,
        [...entries.map(([key, value]) => encode(key, value)), id],
      );
      return decode<Tables[K]>(requireFound(result.rows[0], table));
    },
  };
}
export function createDatabase(sql: SqlDatabase): Database {
  return {
    ...createRepository(sql),
    transaction: (work) =>
      sql.transaction(async (connection) => {
        // A row lock serializes MVP mutations across processes, including last-seat bookings.
        await connection.query(
          'SELECT id FROM micro_access.write_lock WHERE id = 1 FOR UPDATE',
        );
        return work(createRepository(connection));
      }),
    close: () => sql.close(),
  };
}
