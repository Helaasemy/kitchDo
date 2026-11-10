import { getLocalDb } from './db';

export type LocalBackupSummary = {
  id: number;
  createdAt: string;
  reason: string;
  taskCount: number;
};

type LocalOnlyPayload = {
  version: 1;
  tasks: Record<string, unknown>[];
  ticks: Record<string, unknown>[];
  sources: Record<string, unknown>[];
};

const KEEP = 7;

async function snapshotRows(
  userId: string,
): Promise<LocalOnlyPayload> {
  const db = await getLocalDb();
  const tasks = await db.getAllAsync<Record<string, unknown>>(
    'SELECT * FROM local_recurring_tasks WHERE user_id = ?',
    userId,
  );
  const ticks = await db.getAllAsync<Record<string, unknown>>(
    'SELECT * FROM local_task_ticks WHERE user_id = ?',
    userId,
  );
  const sources = await db.getAllAsync<Record<string, unknown>>(
    'SELECT * FROM local_template_sources WHERE user_id = ?',
    userId,
  );
  return { version: 1, tasks, ticks, sources };
}

export async function snapshotLocalOnly(
  userId: string,
  reason: string,
): Promise<void> {
  const db = await getLocalDb();
  const payload = JSON.stringify(await snapshotRows(userId));
  await db.runAsync(
    `INSERT INTO local_backups (user_id, created_at, reason, payload_json)
     VALUES (?, ?, ?, ?)`,
    userId,
    new Date().toISOString(),
    reason,
    payload,
  );
  await db.runAsync(
    `DELETE FROM local_backups WHERE user_id = ? AND id NOT IN (
       SELECT id FROM local_backups WHERE user_id = ? ORDER BY id DESC LIMIT ?
     )`,
    userId,
    userId,
    KEEP,
  );
}

export async function ensureDailyLocalBackup(userId: string): Promise<void> {
  const db = await getLocalDb();
  const latest = await db.getFirstAsync<{ created_at: string }>(
    `SELECT created_at FROM local_backups WHERE user_id = ? ORDER BY id DESC LIMIT 1`,
    userId,
  );
  if (latest?.created_at) {
    const age = Date.now() - Date.parse(latest.created_at);
    if (!Number.isNaN(age) && age < 24 * 60 * 60 * 1000) return;
  }
  await snapshotLocalOnly(userId, 'daily');
}

export async function listLocalBackups(userId: string): Promise<LocalBackupSummary[]> {
  const db = await getLocalDb();
  const rows = await db.getAllAsync<{
    id: number;
    created_at: string;
    reason: string;
    payload_json: string;
  }>(
    `SELECT id, created_at, reason, payload_json FROM local_backups
     WHERE user_id = ? ORDER BY id DESC`,
    userId,
  );
  return rows.map((row) => {
    let taskCount = 0;
    try {
      const payload = JSON.parse(row.payload_json) as LocalOnlyPayload;
      taskCount = payload.tasks?.length ?? 0;
    } catch {
      /* ignore */
    }
    return {
      id: row.id,
      createdAt: row.created_at,
      reason: row.reason,
      taskCount,
    };
  });
}

export async function restoreLocalBackup(
  userId: string,
  backupId: number,
): Promise<void> {
  const db = await getLocalDb();
  const row = await db.getFirstAsync<{ payload_json: string }>(
    `SELECT payload_json FROM local_backups WHERE id = ? AND user_id = ?`,
    backupId,
    userId,
  );
  if (!row) return;
  const payload = JSON.parse(row.payload_json) as LocalOnlyPayload;
  await db.withExclusiveTransactionAsync(async (txn) => {
    for (const task of payload.tasks ?? []) {
      await txn.runAsync(
        `INSERT OR IGNORE INTO local_recurring_tasks (
          user_id, kitchen_id, template_id, item_id, frequency,
          title, section_title, template_title, sort_order, hidden_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NULL)`,
        String(task.user_id),
        String(task.kitchen_id),
        String(task.template_id),
        String(task.item_id),
        String(task.frequency),
        String(task.title),
        task.section_title == null ? null : String(task.section_title),
        String(task.template_title),
        Number(task.sort_order),
      );
      await txn.runAsync(
        `UPDATE local_recurring_tasks SET hidden_at = NULL
         WHERE user_id = ? AND kitchen_id = ? AND item_id = ?`,
        String(task.user_id),
        String(task.kitchen_id),
        String(task.item_id),
      );
    }
    for (const tick of payload.ticks ?? []) {
      await txn.runAsync(
        `INSERT OR IGNORE INTO local_task_ticks (
          user_id, kitchen_id, template_id, item_id, period_key, frequency,
          title_snapshot, template_title_snapshot, ticked_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        String(tick.user_id),
        String(tick.kitchen_id),
        String(tick.template_id),
        String(tick.item_id),
        String(tick.period_key),
        String(tick.frequency),
        String(tick.title_snapshot),
        String(tick.template_title_snapshot),
        String(tick.ticked_at),
      );
    }
    for (const source of payload.sources ?? []) {
      await txn.runAsync(
        `INSERT OR IGNORE INTO local_template_sources (
          user_id, kitchen_id, template_id, preset_id, preset_signature, modified, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
        String(source.user_id),
        String(source.kitchen_id),
        String(source.template_id),
        String(source.preset_id),
        String(source.preset_signature),
        Number(source.modified ?? 0),
        String(source.created_at),
      );
    }
  });
}

/**
 * If this kitchen has no local-only rows but another kitchen for the same
 * user does, move them over. Never deletes.
 */
export async function reassignLocalOnlyKitchen(
  userId: string,
  kitchenId: string,
): Promise<void> {
  const db = await getLocalDb();
  const hasCurrent = await db.getFirstAsync<{ c: number }>(
    `SELECT (
       (SELECT COUNT(*) FROM local_recurring_tasks WHERE user_id = ? AND kitchen_id = ?) +
       (SELECT COUNT(*) FROM local_task_ticks WHERE user_id = ? AND kitchen_id = ?) +
       (SELECT COUNT(*) FROM local_template_sources WHERE user_id = ? AND kitchen_id = ?)
     ) AS c`,
    userId,
    kitchenId,
    userId,
    kitchenId,
    userId,
    kitchenId,
  );
  if ((hasCurrent?.c ?? 0) > 0) return;

  const other = await db.getFirstAsync<{ kitchen_id: string }>(
    `SELECT kitchen_id FROM local_recurring_tasks WHERE user_id = ? AND kitchen_id != ?
     UNION SELECT kitchen_id FROM local_task_ticks WHERE user_id = ? AND kitchen_id != ?
     UNION SELECT kitchen_id FROM local_template_sources WHERE user_id = ? AND kitchen_id != ?
     LIMIT 1`,
    userId,
    kitchenId,
    userId,
    kitchenId,
    userId,
    kitchenId,
  );
  if (!other?.kitchen_id) return;
  const from = other.kitchen_id;

  await db.withExclusiveTransactionAsync(async (txn) => {
    await txn.runAsync(
      `INSERT OR IGNORE INTO local_recurring_tasks (
         user_id, kitchen_id, template_id, item_id, frequency,
         title, section_title, template_title, sort_order, hidden_at
       )
       SELECT user_id, ?, template_id, item_id, frequency,
              title, section_title, template_title, sort_order, hidden_at
       FROM local_recurring_tasks WHERE user_id = ? AND kitchen_id = ?`,
      kitchenId,
      userId,
      from,
    );
    await txn.runAsync(
      `INSERT OR IGNORE INTO local_task_ticks (
         user_id, kitchen_id, template_id, item_id, period_key, frequency,
         title_snapshot, template_title_snapshot, ticked_at
       )
       SELECT user_id, ?, template_id, item_id, period_key, frequency,
              title_snapshot, template_title_snapshot, ticked_at
       FROM local_task_ticks WHERE user_id = ? AND kitchen_id = ?`,
      kitchenId,
      userId,
      from,
    );
    await txn.runAsync(
      `INSERT OR IGNORE INTO local_template_sources (
         user_id, kitchen_id, template_id, preset_id, preset_signature, modified, created_at
       )
       SELECT user_id, ?, template_id, preset_id, preset_signature, modified, created_at
       FROM local_template_sources WHERE user_id = ? AND kitchen_id = ?`,
      kitchenId,
      userId,
      from,
    );
  });
}
