import { afterAll, beforeAll, beforeEach } from 'vitest';
import { migrate } from '../../../scripts/setup.js';
import { createDatabase } from '../repositories/supabase-repository.js';
import type { Database, SqlDatabase } from '../repositories/interfaces.js';
import { createTestSqlDatabase } from './in-memory-repository.js';
import { createCore, type Core } from '../index.js';
import { seedDatabase } from '../seed/seed.js';
import { DEMO_NOW, demoIds } from '../seed/data.js';
import type { User } from '../domain/entities.js';
export { demoIds };
export function useTestDatabase() {
  const state = {} as {
    sql: SqlDatabase;
    db: Database;
    core: Core;
    now: Date;
    participant: User;
    otherParticipant: User;
    volunteer: User;
    admin: User;
  };
  beforeAll(async () => {
    state.sql = createTestSqlDatabase();
    await migrate(state.sql);
    state.db = createDatabase(state.sql);
    state.core = createCore(state.db, { now: () => state.now });
  });
  beforeEach(async () => {
    state.now = new Date(DEMO_NOW);
    await state.sql.query('TRUNCATE TABLE micro_access.users CASCADE');
    await seedDatabase(state.db);
    state.participant = (await state.db.get(
      'users',
      demoIds.participants[0]!,
    ))!;
    state.otherParticipant = (await state.db.get(
      'users',
      demoIds.participants[1]!,
    ))!;
    state.volunteer = (await state.db.get('users', demoIds.volunteers[0]!))!;
    state.admin = (await state.db.get('users', demoIds.admin))!;
  });
  afterAll(async () => {
    await state.db?.close();
  });
  return state;
}
export const ama = {
  service_type: 'ask_me_anything',
  title: 'A practical question',
  details: 'How do I start learning Python?',
  duration_minutes: 10,
};
export const teaching = {
  ...ama,
  service_type: 'teach_me_something',
  duration_minutes: 25,
  preferred_mode: 'live_online',
  prior_knowledge: 'I know variables.',
  desired_outcome: 'Write a loop.',
  availability_windows: [
    { start: '2030-01-07T10:00:00+08:00', end: '2030-01-07T11:00:00+08:00' },
  ],
};
export const review = {
  ...ama,
  service_type: 'review_my_work',
  duration_minutes: 15,
  artifact_text: 'My draft introduction',
  review_goal: 'Improve clarity',
};
export const offer = {
  title: 'A short career story',
  description: 'Practical lessons from my first job.',
  mode: 'live_online',
  starts_at: '2030-01-09T10:00:00+08:00',
  ends_at: '2030-01-09T10:15:00+08:00',
  capacity: 1,
};
export const resultFor = (volunteerId: string) => ({
  volunteerId,
  score: 80,
  reasons: ['Relevant expertise supplied by integration'],
  compatibleWindows: [],
});
