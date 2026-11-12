import { DateTime } from 'luxon';

import { effectiveAssignee, INHERIT_ASSIGNMENT } from '@/features/assignment';
import { getDeviceTimeZone } from '@/lib/dates';
import { getLocalDb } from '@/lib/storage';

import { periodKey, type TaskFrequency } from './period';

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
  assigneeUserId: string | null;
};

export type TickOutcome = 'done' | 'blocked';

export type RecurringTaskState = RecurringTask & {
  /** Accounted for this period — ticked done or marked blocked. */
  done: boolean;
  outcome: TickOutcome | null;
  note: string | null;
};

export type TaskTick = {
  itemId: string;
  templateId: string;
  frequency: TaskFrequency;
  periodKey: string;
  title: string;
  templateTitle: string;
  tickedAt: string;
  outcome: TickOutcome;
  note: string | null;
};

type TaskRow = {
  item_id: string;
  template_id: string;
  frequency: TaskFrequency;
  title: string;
  section_title: string | null;
  template_title: string;
  sort_order: number;
  assignee_user_id?: string | null;
};

const mapTask = (row: TaskRow): RecurringTask => ({
  itemId: row.item_id,
  templateId: row.template_id,
  frequency: row.frequency,
  title: row.title,
  sectionTitle: row.section_title,
  templateTitle: row.template_title,
  sortOrder: row.sort_order,
  assigneeUserId: row.assignee_user_id ?? null,
});

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
    assigneeUserId?: string | null;
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
      if (!task.title.trim()) continue;
      await db.runAsync(
        `INSERT INTO local_recurring_tasks (
          user_id, kitchen_id, template_id, item_id, frequency,
          title, section_title, template_title, sort_order, assignee_user_id
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        input.userId,
        input.kitchenId,
        input.templateId,
        task.itemId,
        task.frequency ?? 'once',
        task.title.trim(),
        task.sectionTitle,
        input.templateTitle,
        task.sortOrder,
        task.assigneeUserId ?? null,
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
  try {
    const { snapshotLocalOnly } = await import('@/lib/storage/localBackup');
    await snapshotLocalOnly(userId, 'archive');
  } catch {
    /* backup is best-effort */
  }
  await db.runAsync(
    `UPDATE local_recurring_tasks SET hidden_at = ?
     WHERE user_id = ? AND kitchen_id = ? AND template_id = ? AND hidden_at IS NULL`,
    new Date().toISOString(),
    userId,
    kitchenId,
    templateId,
  );
}

async function loadRecurringRows(
  userId: string,
  kitchenId: string,
  templateId?: string,
): Promise<TaskRow[]> {
  const db = await getLocalDb();
  const hidden = 'AND COALESCE(hidden_at, \'\') = \'\'';
  try {
    return templateId
      ? await db.getAllAsync<TaskRow>(
          `SELECT * FROM local_recurring_tasks
           WHERE user_id = ? AND kitchen_id = ? AND template_id = ? ${hidden}
           ORDER BY sort_order`,
          userId,
          kitchenId,
          templateId,
        )
      : await db.getAllAsync<TaskRow>(
          `SELECT * FROM local_recurring_tasks
           WHERE user_id = ? AND kitchen_id = ? ${hidden}
           ORDER BY template_title, sort_order`,
          userId,
          kitchenId,
        );
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    if (!/no such column: hidden_at/i.test(message)) throw e;
    return templateId
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
  }
}

/** Recurring tasks with their done state for the current periods. */
export async function listRecurringTasks(
  userId: string,
  kitchenId: string,
  templateId?: string,
): Promise<RecurringTaskState[]> {
  const rows = await loadRecurringRows(userId, kitchenId, templateId);
  if (rows.length === 0) return [];

  const db = await getLocalDb();
  const now = localNow();
  const placeholders = rows.map(() => '?').join(', ');
  const ticks = await db.getAllAsync<{
    item_id: string;
    period_key: string;
    outcome?: string | null;
    note?: string | null;
  }>(
    `SELECT item_id, period_key, outcome, note FROM local_task_ticks
     WHERE user_id = ? AND kitchen_id = ? AND item_id IN (${placeholders})`,
    userId,
    kitchenId,
    ...rows.map((row) => row.item_id),
  );
  const tickByKey = new Map(
    ticks.map((t) => [`${t.item_id}|${t.period_key}`, t] as const),
  );
  let assignments: Awaited<
    ReturnType<(typeof import('@/features/templates/api'))['listKitchenAssignments']>
  > | null = null;
  try {
    const { listKitchenAssignments } = await import('@/features/templates/api');
    assignments = await listKitchenAssignments(kitchenId);
  } catch {
    assignments = null;
  }
  return rows.map((row) => {
    const task = mapTask(row);
    const assigneeUserId = assignments
      ? effectiveAssignee(
          assignments.templates[task.templateId] ?? null,
          assignments.items[task.itemId] ?? INHERIT_ASSIGNMENT,
        )
      : task.assigneeUserId;
    const tick = tickByKey.get(
      `${task.itemId}|${periodKey(task.frequency, now, task.itemId)}`,
    );
    const outcome: TickOutcome | null = !tick
      ? null
      : tick.outcome === 'blocked'
        ? 'blocked'
        : 'done';
    return {
      ...task,
      assigneeUserId,
      done: outcome != null,
      outcome,
      note: tick?.note?.trim() ? tick.note : null,
    };
  });
}

async function upsertTick(input: {
  userId: string;
  kitchenId: string;
  task: RecurringTask;
  outcome: TickOutcome;
  note: string | null;
}): Promise<void> {
  const db = await getLocalDb();
  const now = localNow();
  const key = periodKey(input.task.frequency, now, input.task.itemId);
  const tickedAt = now.toUTC().toISO() ?? new Date().toISOString();
  await db.runAsync(
    `INSERT INTO local_task_ticks (
      user_id, kitchen_id, template_id, item_id, period_key, frequency,
      title_snapshot, template_title_snapshot, ticked_at, outcome, note
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(user_id, kitchen_id, item_id, period_key) DO UPDATE SET
      frequency = excluded.frequency,
      title_snapshot = excluded.title_snapshot,
      template_title_snapshot = excluded.template_title_snapshot,
      ticked_at = excluded.ticked_at,
      outcome = excluded.outcome,
      note = excluded.note`,
    input.userId,
    input.kitchenId,
    input.task.templateId,
    input.task.itemId,
    key,
    input.task.frequency,
    input.task.title,
    input.task.templateTitle,
    tickedAt,
    input.outcome,
    input.note,
  );
}

/** Tick or untick a task for its current period. */
export async function setTaskDone(input: {
  userId: string;
  kitchenId: string;
  task: RecurringTask;
  done: boolean;
}): Promise<void> {
  if (!input.done) {
    const db = await getLocalDb();
    const key = periodKey(input.task.frequency, localNow(), input.task.itemId);
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
  await upsertTick({ ...input, outcome: 'done', note: null });
}

/** Mark a task blocked for this period. A short note is required. */
export async function setTaskBlocked(input: {
  userId: string;
  kitchenId: string;
  task: RecurringTask;
  note: string;
}): Promise<void> {
  const note = input.note.trim();
  if (!note) throw new Error('NOTE_REQUIRED');
  await upsertTick({ ...input, outcome: 'blocked', note });
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
    outcome?: string | null;
    note?: string | null;
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
    outcome: r.outcome === 'blocked' ? 'blocked' : 'done',
    note: r.note?.trim() ? r.note : null,
  }));
}

/** Copy frequencies onto a duplicated template by matching item sort_order (then title). */
export async function copyTemplateFrequencies(input: {
  userId: string;
  kitchenId: string;
  fromTemplateId: string;
  toTemplateId: string;
}): Promise<void> {
  const { getTemplate } = await import('@/features/templates/api');
  const [from, to] = await Promise.all([
    getTemplate(input.fromTemplateId),
    getTemplate(input.toTemplateId),
  ]);
  if (!from || !to) return;
  const frequencies = await getTemplateFrequencies(
    input.userId,
    input.kitchenId,
    input.fromTemplateId,
  );
  const unused = new Set(to.items.map((i) => i.id));
  const mapped: {
    itemId: string;
    frequency: TaskFrequency | null;
    title: string;
    sectionTitle: string | null;
    sortOrder: number;
  }[] = [];
  for (const source of from.items) {
    const freq = frequencies[source.id] ?? 'once';
    const byOrder = to.items.find(
      (i) => unused.has(i.id) && i.sortOrder === source.sortOrder,
    );
    const byTitle = to.items.find(
      (i) => unused.has(i.id) && i.title === source.title,
    );
    const match = byOrder ?? byTitle;
    if (!match) continue;
    unused.delete(match.id);
    mapped.push({
      itemId: match.id,
      frequency: freq,
      title: match.title,
      sectionTitle: null,
      sortOrder: match.sortOrder,
    });
  }
  if (mapped.length === 0) return;
  await saveTemplateFrequencies({
    userId: input.userId,
    kitchenId: input.kitchenId,
    templateId: input.toTemplateId,
    templateTitle: to.title,
    tasks: mapped,
  });
}
