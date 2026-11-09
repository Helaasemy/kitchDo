import { LOCAL_SCHEMA_SQL, SQLITE_MIGRATIONS } from './migrations';

/** The subset of expo-sqlite's database API the migrator needs. */
export type MigratableDb = {
  execAsync(sql: string): Promise<void>;
  getAllAsync<T>(sql: string, ...params: (string | number | null)[]): Promise<T[]>;
  runAsync(sql: string, ...params: (string | number | null)[]): Promise<unknown>;
  withTransactionAsync(task: () => Promise<void>): Promise<void>;
};

export const LATEST_SQLITE_VERSION = Math.max(...SQLITE_MIGRATIONS.map((m) => m.version));

/**
 * Applies every unapplied migration in order, each in its own transaction,
 * then re-asserts the device-only tables. Safe to call repeatedly.
 */
export async function applyMigrations(db: MigratableDb): Promise<number> {
  await db.execAsync(`
    PRAGMA foreign_keys = ON;
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version INTEGER PRIMARY KEY NOT NULL
    );
  `);

  const rows = await db.getAllAsync<{ version: number }>(
    'SELECT version FROM schema_migrations ORDER BY version',
  );
  const applied = new Set(rows.map((r) => r.version));

  for (const migration of [...SQLITE_MIGRATIONS].sort((a, b) => a.version - b.version)) {
    if (applied.has(migration.version)) continue;
    await db.withTransactionAsync(async () => {
      await db.execAsync(migration.sql);
      await db.runAsync(
        'INSERT INTO schema_migrations (version) VALUES (?)',
        migration.version,
      );
    });
  }

  await db.execAsync(LOCAL_SCHEMA_SQL);
  return LATEST_SQLITE_VERSION;
}
