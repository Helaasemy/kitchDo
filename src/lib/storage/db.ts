import * as SQLite from 'expo-sqlite';

import { applyMigrations, LATEST_SQLITE_VERSION } from './migrate';

const DB_NAME = 'kdo_local_v1.db';

let dbPromise: Promise<SQLite.SQLiteDatabase> | null = null;
/** Schema version the open connection was migrated to. */
let migratedTo = 0;
let catchUp: Promise<void> | null = null;

export async function getLocalDb(): Promise<SQLite.SQLiteDatabase> {
  if (!dbPromise) {
    const opening = (async () => {
      const db = await SQLite.openDatabaseAsync(DB_NAME);
      migratedTo = await applyMigrations(db);
      return db;
    })();
    dbPromise = opening;
    // A failed open is retried on the next call instead of sticking.
    opening.catch(() => {
      if (dbPromise === opening) dbPromise = null;
    });
  }
  const db = await dbPromise;
  // A connection opened before newer migrations were bundled catches up once.
  if (migratedTo < LATEST_SQLITE_VERSION) {
    catchUp ??= applyMigrations(db)
      .then((version) => {
        migratedTo = version;
      })
      .finally(() => {
        catchUp = null;
      });
    await catchUp;
  }
  return db;
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
    await db.runAsync('DELETE FROM local_recurring_tasks WHERE user_id = ?', userId);
    await db.runAsync('DELETE FROM local_task_ticks WHERE user_id = ?', userId);
    await db.runAsync('DELETE FROM local_template_sources WHERE user_id = ?', userId);
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
