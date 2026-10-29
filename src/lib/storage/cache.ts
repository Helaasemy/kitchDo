import { getLocalDb } from './db';
import type {
  CachedIssue,
  CachedRevision,
  CachedRun,
  CachedRunItem,
} from './types';

function mapRun(row: Record<string, unknown>): CachedRun {
  return {
    id: String(row.id),
    userId: String(row.user_id),
    kitchenId: String(row.kitchen_id),
    templateId: String(row.template_id),
    templateRevisionId: String(row.template_revision_id),
    scheduleId: row.schedule_id == null ? null : String(row.schedule_id),
    source: String(row.source),
    occurrenceKey: String(row.occurrence_key),
    titleSnapshot: String(row.title_snapshot),
    categoryIdSnapshot:
      row.category_id_snapshot == null
        ? null
        : String(row.category_id_snapshot),
    categoryNameSnapshot:
      row.category_name_snapshot == null
        ? null
        : String(row.category_name_snapshot),
    localDate: String(row.local_date),
    timezoneSnapshot: String(row.timezone_snapshot),
    scheduledFor: String(row.scheduled_for),
    dueAt: row.due_at == null ? null : String(row.due_at),
    state: String(row.state),
    revision: Number(row.revision),
    completedAt: row.completed_at == null ? null : String(row.completed_at),
    closedAt: row.closed_at == null ? null : String(row.closed_at),
    updatedAt: String(row.updated_at),
    pendingCreate: Number(row.pending_create) === 1,
  };
}

function mapItem(row: Record<string, unknown>): CachedRunItem {
  return {
    id: String(row.id),
    userId: String(row.user_id),
    kitchenId: String(row.kitchen_id),
    runId: String(row.run_id),
    sourceItemId: String(row.source_item_id),
    sourceSectionId:
      row.source_section_id == null ? null : String(row.source_section_id),
    sectionTitleSnapshot:
      row.section_title_snapshot == null
        ? null
        : String(row.section_title_snapshot),
    sectionOrderSnapshot:
      row.section_order_snapshot == null
        ? null
        : Number(row.section_order_snapshot),
    titleSnapshot: String(row.title_snapshot),
    instructionsSnapshot:
      row.instructions_snapshot == null
        ? null
        : String(row.instructions_snapshot),
    responseTypeSnapshot: String(row.response_type_snapshot),
    sortOrder: Number(row.sort_order),
    outcome: String(row.outcome),
    note: row.note == null ? null : String(row.note),
    recordedAt: row.recorded_at == null ? null : String(row.recorded_at),
    revision: Number(row.revision),
    updatedAt: String(row.updated_at),
  };
}

function mapIssue(row: Record<string, unknown>): CachedIssue {
  return {
    id: String(row.id),
    userId: String(row.user_id),
    kitchenId: String(row.kitchen_id),
    runId: String(row.run_id),
    runItemId: row.run_item_id == null ? null : String(row.run_item_id),
    description: String(row.description),
    state: String(row.state),
    resolutionNote:
      row.resolution_note == null ? null : String(row.resolution_note),
    reportedAt: String(row.reported_at),
    resolvedAt: row.resolved_at == null ? null : String(row.resolved_at),
    revision: Number(row.revision),
    updatedAt: String(row.updated_at),
  };
}

export async function upsertCachedRevision(rev: CachedRevision): Promise<void> {
  const db = await getLocalDb();
  await db.runAsync(
    `INSERT INTO cached_revisions (
      id, user_id, kitchen_id, template_id, version, published_at, definition_json, title
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(user_id, id) DO UPDATE SET
      version = excluded.version,
      published_at = excluded.published_at,
      definition_json = excluded.definition_json,
      title = excluded.title`,
    rev.id,
    rev.userId,
    rev.kitchenId,
    rev.templateId,
    rev.version,
    rev.publishedAt,
    rev.definitionJson,
    rev.title,
  );
}

export async function getCachedRevision(
  userId: string,
  revisionId: string,
): Promise<CachedRevision | null> {
  const db = await getLocalDb();
  const row = await db.getFirstAsync<Record<string, unknown>>(
    `SELECT * FROM cached_revisions WHERE user_id = ? AND id = ?`,
    userId,
    revisionId,
  );
  if (!row) return null;
  return {
    id: String(row.id),
    userId: String(row.user_id),
    kitchenId: String(row.kitchen_id),
    templateId: String(row.template_id),
    version: Number(row.version),
    publishedAt: String(row.published_at),
    definitionJson: String(row.definition_json),
    title: String(row.title),
  };
}

export async function listCachedRevisionsForKitchen(
  userId: string,
  kitchenId: string,
): Promise<CachedRevision[]> {
  const db = await getLocalDb();
  const rows = await db.getAllAsync<Record<string, unknown>>(
    `SELECT * FROM cached_revisions WHERE user_id = ? AND kitchen_id = ?`,
    userId,
    kitchenId,
  );
  return rows.map((row) => ({
    id: String(row.id),
    userId: String(row.user_id),
    kitchenId: String(row.kitchen_id),
    templateId: String(row.template_id),
    version: Number(row.version),
    publishedAt: String(row.published_at),
    definitionJson: String(row.definition_json),
    title: String(row.title),
  }));
}

export async function upsertCachedRun(run: CachedRun): Promise<void> {
  const db = await getLocalDb();
  await db.runAsync(
    `INSERT INTO cached_runs (
      id, user_id, kitchen_id, template_id, template_revision_id, schedule_id,
      source, occurrence_key, title_snapshot, category_id_snapshot, category_name_snapshot,
      local_date, timezone_snapshot, scheduled_for, due_at, state, revision,
      completed_at, closed_at, updated_at, pending_create
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(user_id, id) DO UPDATE SET
      schedule_id = excluded.schedule_id,
      title_snapshot = excluded.title_snapshot,
      category_id_snapshot = excluded.category_id_snapshot,
      category_name_snapshot = excluded.category_name_snapshot,
      due_at = excluded.due_at,
      state = excluded.state,
      revision = excluded.revision,
      completed_at = excluded.completed_at,
      closed_at = excluded.closed_at,
      updated_at = excluded.updated_at,
      pending_create = excluded.pending_create`,
    run.id,
    run.userId,
    run.kitchenId,
    run.templateId,
    run.templateRevisionId,
    run.scheduleId,
    run.source,
    run.occurrenceKey,
    run.titleSnapshot,
    run.categoryIdSnapshot,
    run.categoryNameSnapshot,
    run.localDate,
    run.timezoneSnapshot,
    run.scheduledFor,
    run.dueAt,
    run.state,
    run.revision,
    run.completedAt,
    run.closedAt,
    run.updatedAt,
    run.pendingCreate ? 1 : 0,
  );
}

export async function upsertCachedRunItem(item: CachedRunItem): Promise<void> {
  const db = await getLocalDb();
  await db.runAsync(
    `INSERT INTO cached_run_items (
      id, user_id, kitchen_id, run_id, source_item_id, source_section_id,
      section_title_snapshot, section_order_snapshot, title_snapshot,
      instructions_snapshot, response_type_snapshot, sort_order, outcome,
      note, recorded_at, revision, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(user_id, id) DO UPDATE SET
      outcome = excluded.outcome,
      note = excluded.note,
      recorded_at = excluded.recorded_at,
      revision = excluded.revision,
      updated_at = excluded.updated_at`,
    item.id,
    item.userId,
    item.kitchenId,
    item.runId,
    item.sourceItemId,
    item.sourceSectionId,
    item.sectionTitleSnapshot,
    item.sectionOrderSnapshot,
    item.titleSnapshot,
    item.instructionsSnapshot,
    item.responseTypeSnapshot,
    item.sortOrder,
    item.outcome,
    item.note,
    item.recordedAt,
    item.revision,
    item.updatedAt,
  );
}

export async function upsertCachedIssue(issue: CachedIssue): Promise<void> {
  const db = await getLocalDb();
  await db.runAsync(
    `INSERT INTO cached_issues (
      id, user_id, kitchen_id, run_id, run_item_id, description, state,
      resolution_note, reported_at, resolved_at, revision, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(user_id, id) DO UPDATE SET
      description = excluded.description,
      state = excluded.state,
      resolution_note = excluded.resolution_note,
      resolved_at = excluded.resolved_at,
      revision = excluded.revision,
      updated_at = excluded.updated_at`,
    issue.id,
    issue.userId,
    issue.kitchenId,
    issue.runId,
    issue.runItemId,
    issue.description,
    issue.state,
    issue.resolutionNote,
    issue.reportedAt,
    issue.resolvedAt,
    issue.revision,
    issue.updatedAt,
  );
}

export async function listCachedRunsForKitchen(
  userId: string,
  kitchenId: string,
): Promise<CachedRun[]> {
  const db = await getLocalDb();
  const rows = await db.getAllAsync<Record<string, unknown>>(
    `SELECT * FROM cached_runs
     WHERE user_id = ? AND kitchen_id = ?
     ORDER BY local_date DESC, scheduled_for DESC`,
    userId,
    kitchenId,
  );
  return rows.map(mapRun);
}

export async function getCachedRun(
  userId: string,
  runId: string,
): Promise<CachedRun | null> {
  const db = await getLocalDb();
  const row = await db.getFirstAsync<Record<string, unknown>>(
    `SELECT * FROM cached_runs WHERE user_id = ? AND id = ?`,
    userId,
    runId,
  );
  return row ? mapRun(row) : null;
}

export async function getCachedRunByOccurrenceKey(
  userId: string,
  kitchenId: string,
  occurrenceKey: string,
): Promise<CachedRun | null> {
  const db = await getLocalDb();
  const row = await db.getFirstAsync<Record<string, unknown>>(
    `SELECT * FROM cached_runs
     WHERE user_id = ? AND kitchen_id = ? AND occurrence_key = ?`,
    userId,
    kitchenId,
    occurrenceKey,
  );
  return row ? mapRun(row) : null;
}

export async function listCachedItemsForRun(
  userId: string,
  runId: string,
): Promise<CachedRunItem[]> {
  const db = await getLocalDb();
  const rows = await db.getAllAsync<Record<string, unknown>>(
    `SELECT * FROM cached_run_items
     WHERE user_id = ? AND run_id = ?
     ORDER BY sort_order ASC, id ASC`,
    userId,
    runId,
  );
  return rows.map(mapItem);
}

export async function getCachedRunItem(
  userId: string,
  itemId: string,
): Promise<CachedRunItem | null> {
  const db = await getLocalDb();
  const row = await db.getFirstAsync<Record<string, unknown>>(
    `SELECT * FROM cached_run_items WHERE user_id = ? AND id = ?`,
    userId,
    itemId,
  );
  return row ? mapItem(row) : null;
}

export async function listCachedIssuesForRun(
  userId: string,
  runId: string,
): Promise<CachedIssue[]> {
  const db = await getLocalDb();
  const rows = await db.getAllAsync<Record<string, unknown>>(
    `SELECT * FROM cached_issues WHERE user_id = ? AND run_id = ?`,
    userId,
    runId,
  );
  return rows.map(mapIssue);
}

export async function getCachedIssue(
  userId: string,
  issueId: string,
): Promise<CachedIssue | null> {
  const db = await getLocalDb();
  const row = await db.getFirstAsync<Record<string, unknown>>(
    `SELECT * FROM cached_issues WHERE user_id = ? AND id = ?`,
    userId,
    issueId,
  );
  return row ? mapIssue(row) : null;
}

export async function listCachedItemsForRuns(
  userId: string,
  runIds: string[],
): Promise<CachedRunItem[]> {
  if (runIds.length === 0) return [];
  const db = await getLocalDb();
  const placeholders = runIds.map(() => '?').join(',');
  const rows = await db.getAllAsync<Record<string, unknown>>(
    `SELECT * FROM cached_run_items
     WHERE user_id = ? AND run_id IN (${placeholders})`,
    userId,
    ...runIds,
  );
  return rows.map(mapItem);
}

/** Replace provisional client items with server rows after create_manual_run syncs. */
export async function replaceCachedItemsForRun(
  userId: string,
  runId: string,
  items: CachedRunItem[],
): Promise<void> {
  const db = await getLocalDb();
  await db.runAsync(
    `DELETE FROM cached_run_items WHERE user_id = ? AND run_id = ?`,
    userId,
    runId,
  );
  for (const item of items) {
    await upsertCachedRunItem(item);
  }
}
