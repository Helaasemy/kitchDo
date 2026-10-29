import * as SQLite from 'expo-sqlite';

import { SQLITE_MIGRATIONS } from './migrations';

const DB_NAME = 'kdo_local_v1.db';

let dbPromise: Promise<SQLite.SQLiteDatabase> | null = null;

async function applyMigrations(db: SQLite.SQLiteDatabase): Promise<void> {
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

  for (const migration of SQLITE_MIGRATIONS) {
    if (applied.has(migration.version)) continue;
    await db.withTransactionAsync(async () => {
      await db.execAsync(migration.sql);
      await db.runAsync(
        'INSERT INTO schema_migrations (version) VALUES (?)',
        migration.version,
      );
    });
  }
}

export async function getLocalDb(): Promise<SQLite.SQLiteDatabase> {
  if (!dbPromise) {
    dbPromise = (async () => {
      const db = await SQLite.openDatabaseAsync(DB_NAME);
      await applyMigrations(db);
      return db;
    })();
  }
  return dbPromise;
}

/** Drop all account-scoped rows for a user (sign-out / account switch). */
export async function clearAccountLocalData(userId: string): Promise<void> {
  const db = await getLocalDb();
  await db.withTransactionAsync(async () => {
    await db.runAsync('DELETE FROM outbox WHERE user_id = ?', userId);
    await db.runAsync('DELETE FROM cached_run_items WHERE user_id = ?', userId);
    await db.runAsync('DELETE FROM cached_issues WHERE user_id = ?', userId);
    await db.runAsync('DELETE FROM cached_runs WHERE user_id = ?', userId);
    await db.runAsync('DELETE FROM cached_revisions WHERE user_id = ?', userId);
    await db.runAsync('DELETE FROM sync_meta WHERE user_id = ?', userId);
    await db.runAsync('DELETE FROM notification_map WHERE user_id = ?', userId);
  });
}

export async function getSyncMeta(
  userId: string,
  kitchenId: string,
  key: string,
): Promise<string | null> {
  const db = await getLocalDb();
  const row = await db.getFirstAsync<{ value: string }>(
    'SELECT value FROM sync_meta WHERE user_id = ? AND kitchen_id = ? AND key = ?',
    userId,
    kitchenId,
    key,
  );
  return row?.value ?? null;
}

export async function setSyncMeta(
  userId: string,
  kitchenId: string,
  key: string,
  value: string,
): Promise<void> {
  const db = await getLocalDb();
  await db.runAsync(
    `INSERT INTO sync_meta (user_id, kitchen_id, key, value)
     VALUES (?, ?, ?, ?)
     ON CONFLICT(user_id, kitchen_id, key) DO UPDATE SET value = excluded.value`,
    userId,
    kitchenId,
    key,
    value,
  );
}
