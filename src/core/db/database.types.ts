// Database row shapes; all application tables live in the private micro_access schema.
export type { Tables as DatabaseTables } from '../domain/entities.js';
export type { SqlDatabase, SqlExecutor } from '../repositories/interfaces.js';
