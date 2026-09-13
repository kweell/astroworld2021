import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import { readConfig } from '../config.js';
import { connectDatabase } from '../db/client.js';
import type { Database, Table } from '../repositories/interfaces.js';
import { buildSeed } from './data.js';
export async function seedDatabase(db: Database): Promise<void> {
  const seed = buildSeed();
  await db.transaction(async (repo) => {
    // Insert missing fixed IDs only. Re-running never resets bookings or user edits.
    for (const table of Object.keys(seed) as Table[]) {
      for (const row of seed[table]) {
        const id = 'id' in row ? row.id : row.user_id;
        if (!(await repo.get(table, id))) await repo.insert(table, row);
      }
    }
  });
}
if (
  process.argv[1] &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  const db = await connectDatabase(readConfig());
  try {
    await seedDatabase(db);
    console.log(
      'Seed complete: 6 participants, 8 volunteers, 2 operators, 3 requests, 3 offers.',
    );
  } finally {
    await db.close();
  }
}
