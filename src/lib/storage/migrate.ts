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
    try {
      await db.withTransactionAsync(async () => {
        await db.execAsync(migration.sql);
        await db.runAsync(
          'INSERT INTO schema_migrations (version) VALUES (?)',
          migration.version,
        );
      });
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      // v6 ADD COLUMN fails if LOCAL_SCHEMA_SQL already created hidden_at.
      if (migration.version === 6 && /duplicate column name/i.test(message)) {
        await db.runAsync(
          'INSERT OR IGNORE INTO schema_migrations (version) VALUES (?)',
          migration.version,
        );
        continue;
      }
      throw e;
    }
  }

  await db.execAsync(LOCAL_SCHEMA_SQL);
  await ensureColumn(db, 'local_recurring_tasks', 'hidden_at', 'TEXT');
  return LATEST_SQLITE_VERSION;
}

async function ensureColumn(
  db: MigratableDb,
  table: string,
  column: string,
  type: string,
): Promise<void> {
  try {
    const cols = await db.getAllAsync<{ name: string }>(`PRAGMA table_info(${table})`);
    if (cols.some((c) => c.name === column)) return;
  } catch {
    /* some adapters reject PRAGMA via getAllAsync */
  }
  try {
    await db.execAsync(`ALTER TABLE ${table} ADD COLUMN ${column} ${type}`);
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    if (!/duplicate column name/i.test(message)) throw e;
  }
}
