import { createHash } from 'node:crypto';
import { readdir, readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import { readConfig } from '../src/core/config.js';
import { createSqlDatabase } from '../src/core/db/client.js';
import type { SqlDatabase } from '../src/core/repositories/interfaces.js';
export async function migrate(db: SqlDatabase): Promise<void> {
  const directory = resolve('supabase/migrations');
  await db.query('CREATE SCHEMA IF NOT EXISTS micro_access');
  await db.query(
    'CREATE TABLE IF NOT EXISTS micro_access.schema_migrations (name text PRIMARY KEY, checksum text NOT NULL, applied_at timestamptz NOT NULL DEFAULT now())',
  );
  for (const name of (await readdir(directory))
    .filter((name) => name.endsWith('.sql'))
    .sort()) {
    const content = await readFile(resolve(directory, name), 'utf8');
    const checksum = createHash('sha256').update(content).digest('hex');
    await db.transaction(async (tx) => {
      await tx.query(
        'LOCK TABLE micro_access.schema_migrations IN EXCLUSIVE MODE',
      );
      const applied = await tx.query<{ checksum: string }>(
        'SELECT checksum FROM micro_access.schema_migrations WHERE name = $1',
        [name],
      );
      if (applied.rows[0]) {
        if (applied.rows[0].checksum !== checksum)
          throw new Error(`Applied migration changed: ${name}`);
        return;
      }
      await tx.exec(content);
      await tx.query(
        'INSERT INTO micro_access.schema_migrations (name, checksum) VALUES ($1, $2)',
        [name, checksum],
      );
    });
  }
}
if (
  process.argv[1] &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  const db = await createSqlDatabase(readConfig());
  try {
    await migrate(db);
    console.log('All database migrations applied.');
  } finally {
    await db.close();
  }
}
