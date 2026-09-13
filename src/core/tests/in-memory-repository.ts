// Tests exercise the real SQL repository and migrations using in-memory PostgreSQL.
// There is deliberately no second implementation of persistence business rules.
export { createLocalSqlDatabase as createTestSqlDatabase } from '../db/client.js';
