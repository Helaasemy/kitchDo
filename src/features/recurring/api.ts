import { DateTime } from 'luxon';

import { getDeviceTimeZone } from '@/lib/dates';
import { getLocalDb } from '@/lib/storage';

import { periodKey, TASK_FREQUENCIES, type TaskFrequency } from './period';

/**
 * Task frequencies and ticks live only in this device's SQLite; the server
 * template has no frequency field yet. Each saved template refreshes its rows,
 * so titles here are the latest saved wording.
 */
export type RecurringTask = {
  itemId: string;
  templateId: string;
  frequency: TaskFrequency;
  title: string;
  sectionTitle: string | null;
  templateTitle: string;
  sortOrder: number;
};

export type RecurringTaskState = RecurringTask & {
  /** Ticked in the current day / week / month. */
  done: boolean;
};

export type TaskTick = {
  itemId: string;
  templateId: string;
  frequency: TaskFrequency;
  periodKey: string;
  title: string;
  templateTitle: string;
  tickedAt: string;
};

type TaskRow = {
  item_id: string;
  template_id: string;
  frequency: TaskFrequency;
  title: string;
  section_title: string | null;
  template_title: string;
  sort_order: number;
};

const mapTask = (row: TaskRow): RecurringTask => ({
  itemId: row.item_id,
  templateId: row.template_id,
  frequency: row.frequency,
  title: row.title,
  sectionTitle: row.section_title,
  templateTitle: row.template_title,
  sortOrder: row.sort_order,
});

function currentPeriodKeys(now: DateTime): Record<TaskFrequency, string> {
  return {
    daily: periodKey('daily', now),
    weekly: periodKey('weekly', now),
    monthly: periodKey('monthly', now),
  };
}

const localNow = () => DateTime.now().setZone(getDeviceTimeZone());

export async function getTemplateFrequencies(
  userId: string,
  kitchenId: string,
  templateId: string,
): Promise<Record<string, TaskFrequency>> {
  const db = await getLocalDb();
  const rows = await db.getAllAsync<{ item_id: string; frequency: TaskFrequency }>(
    `SELECT item_id, frequency FROM local_recurring_tasks
     WHERE user_id = ? AND kitchen_id = ? AND template_id = ?`,
    userId,
    kitchenId,
    templateId,
  );
  return Object.fromEntries(rows.map((r) => [r.item_id, r.frequency]));
}

/** Replace a template's recurring tasks after it is saved. */
export async function saveTemplateFrequencies(input: {
  userId: string;
  kitchenId: string;
  templateId: string;
  templateTitle: string;
  tasks: {
    itemId: string;
    frequency: TaskFrequency | null;
    title: string;
    sectionTitle: string | null;
    sortOrder: number;
  }[];
}): Promise<void> {
  const db = await getLocalDb();
  await db.withTransactionAsync(async () => {
    await db.runAsync(
      `DELETE FROM local_recurring_tasks
       WHERE user_id = ? AND kitchen_id = ? AND template_id = ?`,
      input.userId,
      input.kitchenId,
      input.templateId,
    );
    for (const task of input.tasks) {
      if (!task.frequency || !task.title.trim()) continue;
      await db.runAsync(
        `INSERT INTO local_recurring_tasks (
          user_id, kitchen_id, template_id, item_id, frequency,
          title, section_title, template_title, sort_order
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        input.userId,
        input.kitchenId,
        input.templateId,
        task.itemId,
        task.frequency,
        task.title.trim(),
        task.sectionTitle,
        input.templateTitle,
        task.sortOrder,
      );
    }
  });
}

/** Archived templates stop showing recurring tasks; past ticks stay in History. */
export async function clearTemplateFrequencies(
  userId: string,
  kitchenId: string,
  templateId: string,
): Promise<void> {
  const db = await getLocalDb();
  await db.runAsync(
    `DELETE FROM local_recurring_tasks
     WHERE user_id = ? AND kitchen_id = ? AND template_id = ?`,
    userId,
    kitchenId,
    templateId,
  );
}

/** Recurring tasks with their done state for the current periods. */
export async function listRecurringTasks(
  userId: string,
  kitchenId: string,
  templateId?: string,
): Promise<RecurringTaskState[]> {
  const db = await getLocalDb();
  const rows = templateId
    ? await db.getAllAsync<TaskRow>(
        `SELECT * FROM local_recurring_tasks
         WHERE user_id = ? AND kitchen_id = ? AND template_id = ?
         ORDER BY sort_order`,
        userId,
        kitchenId,
        templateId,
      )
    : await db.getAllAsync<TaskRow>(
        `SELECT * FROM local_recurring_tasks
         WHERE user_id = ? AND kitchen_id = ?
         ORDER BY template_title, sort_order`,
        userId,
        kitchenId,
      );
  if (rows.length === 0) return [];

  const keys = currentPeriodKeys(localNow());
  const ticks = await db.getAllAsync<{ item_id: string; period_key: string }>(
    `SELECT item_id, period_key FROM local_task_ticks
     WHERE user_id = ? AND kitchen_id = ? AND period_key IN (?, ?, ?)`,
    userId,
    kitchenId,
    ...TASK_FREQUENCIES.map((f) => keys[f]),
  );
  const done = new Set(ticks.map((t) => `${t.item_id}|${t.period_key}`));
  return rows.map((row) => {
    const task = mapTask(row);
    return { ...task, done: done.has(`${task.itemId}|${keys[task.frequency]}`) };
  });
}

/** Tick or untick a task for its current period. */
export async function setTaskDone(input: {
  userId: string;
  kitchenId: string;
  task: RecurringTask;
  done: boolean;
}): Promise<void> {
  const db = await getLocalDb();
  const now = localNow();
  const key = periodKey(input.task.frequency, now);
  if (!input.done) {
    await db.runAsync(
      `DELETE FROM local_task_ticks
       WHERE user_id = ? AND kitchen_id = ? AND item_id = ? AND period_key = ?`,
      input.userId,
      input.kitchenId,
      input.task.itemId,
      key,
    );
    return;
  }
  await db.runAsync(
    `INSERT OR IGNORE INTO local_task_ticks (
      user_id, kitchen_id, template_id, item_id, period_key, frequency,
      title_snapshot, template_title_snapshot, ticked_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    input.userId,
    input.kitchenId,
    input.task.templateId,
    input.task.itemId,
    key,
    input.task.frequency,
    input.task.title,
    input.task.templateTitle,
    now.toUTC().toISO() ?? new Date().toISOString(),
  );
}

/** Most recent ticks, newest first, for History. */
export async function listRecentTicks(
  userId: string,
  kitchenId: string,
  limit = 200,
): Promise<TaskTick[]> {
  const db = await getLocalDb();
  const rows = await db.getAllAsync<{
    item_id: string;
    template_id: string;
    frequency: TaskFrequency;
    period_key: string;
    title_snapshot: string;
    template_title_snapshot: string;
    ticked_at: string;
  }>(
    `SELECT * FROM local_task_ticks
     WHERE user_id = ? AND kitchen_id = ?
     ORDER BY ticked_at DESC
     LIMIT ?`,
    userId,
    kitchenId,
    limit,
  );
  return rows.map((r) => ({
    itemId: r.item_id,
    templateId: r.template_id,
    frequency: r.frequency,
    periodKey: r.period_key,
    title: r.title_snapshot,
    templateTitle: r.template_title_snapshot,
    tickedAt: r.ticked_at,
  }));
}
