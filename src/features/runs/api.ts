import { DateTime } from 'luxon';

import {
  countOutcomes,
  reconcileRunState,
  requiresExceptionNote,
  type RunItemOutcome,
} from '@/domain/runProgress';
import {
  materializeItemsFromDefinition,
  parseTemplateDefinition,
} from '@/domain/templateDefinition';
import {
  MANUAL_DUE_AFTER_MINUTES,
  getDeviceTimeZone,
  localDateString,
  manualOccurrenceKey,
  nowLocal,
} from '@/lib/dates';
import { newId } from '@/lib/ids';
import { cancelReminderForOccurrence } from '@/lib/notifications';
import {
  discardOutboxRow,
  enqueueOutbox,
  getCachedIssue,
  getCachedRevision,
  getCachedRun,
  getCachedRunByOccurrenceKey,
  getCachedRunItem,
  getLocalDb,
  listCachedIssuesForRun,
  listCachedItemsForRun,
  listCachedItemsForRuns,
  listCachedRunsForKitchen,
  listPendingOutbox,
  upsertCachedIssue,
  upsertCachedRevision,
  upsertCachedRun,
  upsertCachedRunItem,
} from '@/lib/storage';
import { getSupabase, rpcErrorMessage } from '@/lib/supabase';
import {
  ensureScheduledOccurrences,
  flushOutbox,
  pullKitchenCache,
} from '@/lib/sync';

import type { RunDetail, RunItemView, RunSummary } from './types';

function formatDueLabel(
  scheduledFor: string,
  dueAt: string | null,
  zone: string,
): string {
  const start = DateTime.fromISO(scheduledFor, { setZone: true }).setZone(zone);
  const time = start.isValid ? start.toFormat('HH:mm') : '';
  if (!dueAt) return time ? `Starts ${time}` : 'Manual';
  const due = DateTime.fromISO(dueAt, { setZone: true }).setZone(zone);
  if (!due.isValid) return time ? `Starts ${time}` : '';
  return time ? `${time} · due ${due.toFormat('HH:mm')}` : `Due ${due.toFormat('HH:mm')}`;
}

function isUrgent(dueAt: string | null, state: string): boolean {
  if (!dueAt || state === 'finished' || state === 'cancelled') return false;
  const due = DateTime.fromISO(dueAt, { setZone: true });
  return due.isValid && due < DateTime.utc();
}

async function summariesFromCache(
  userId: string,
  kitchenId: string,
): Promise<RunSummary[]> {
  const zone = getDeviceTimeZone();
  const runs = await listCachedRunsForKitchen(userId, kitchenId);
  const items = await listCachedItemsForRuns(
    userId,
    runs.map((r) => r.id),
  );
  const byRun = new Map<string, string[]>();
  for (const item of items) {
    const list = byRun.get(item.runId) ?? [];
    list.push(item.outcome);
    byRun.set(item.runId, list);
  }

  return runs.map((run) => {
    const counts = countOutcomes(byRun.get(run.id) ?? []);
    return {
      id: run.id,
      title: run.titleSnapshot,
      localDate: run.localDate,
      dueLabel: formatDueLabel(run.scheduledFor, run.dueAt, zone),
      scheduledFor: run.scheduledFor,
      dueAt: run.dueAt,
      progressDone: counts.done + counts.notApplicable + counts.blocked,
      progressTotal: counts.total,
      blocked: counts.blocked,
      state: run.state,
      urgency: isUrgent(run.dueAt, run.state),
      categoryName: run.categoryNameSnapshot,
      occurrenceKey: run.occurrenceKey,
      source: run.source,
    };
  });
}

export async function listTodayRuns(
  userId: string,
  kitchenId: string,
): Promise<{
  due: RunSummary[];
  earlierUnfinished: RunSummary[];
}> {
  const zone = getDeviceTimeZone();
  const today = localDateString(nowLocal(zone));
  const all = await summariesFromCache(userId, kitchenId);

  const due = all
    .filter(
      (r) =>
        r.localDate === today &&
        r.state !== 'finished' &&
        r.state !== 'cancelled',
    )
    .sort((a, b) => a.scheduledFor.localeCompare(b.scheduledFor));

  const earlierUnfinished = all
    .filter(
      (r) =>
        r.localDate < today &&
        r.state !== 'finished' &&
        r.state !== 'cancelled',
    )
    .sort((a, b) => b.localDate.localeCompare(a.localDate))
    .slice(0, 20);

  return { due, earlierUnfinished };
}

export async function getRunDetail(
  userId: string,
  runId: string,
): Promise<RunDetail | null> {
  const run = await getCachedRun(userId, runId);
  if (!run) return null;
  const items = await listCachedItemsForRun(userId, runId);
  const issues = await listCachedIssuesForRun(userId, runId);
  const issueByItem = new Map(
    issues
      .filter((i) => i.runItemId)
      .map((i) => [i.runItemId as string, i] as const),
  );

  const views: RunItemView[] = items.map((item) => {
    const issue = issueByItem.get(item.id);
    return {
      id: item.id,
      title: item.titleSnapshot,
      instructions: item.instructionsSnapshot,
      sectionTitle: item.sectionTitleSnapshot,
      sectionOrder: item.sectionOrderSnapshot,
      sortOrder: item.sortOrder,
      outcome: item.outcome,
      note: item.note,
      revision: item.revision,
      recordedAt: item.recordedAt,
      issueId: issue?.id ?? null,
      issueRevision: issue?.revision ?? null,
      issueState: issue?.state ?? null,
    };
  });

  const counts = countOutcomes(views.map((v) => v.outcome));
  return {
    id: run.id,
    title: run.titleSnapshot,
    localDate: run.localDate,
    timezone: run.timezoneSnapshot,
    scheduledFor: run.scheduledFor,
    dueAt: run.dueAt,
    state: run.state,
    revision: run.revision,
    source: run.source,
    occurrenceKey: run.occurrenceKey,
    categoryName: run.categoryNameSnapshot,
    pendingCreate: run.pendingCreate,
    items: views,
    done: counts.done,
    notApplicable: counts.notApplicable,
    blocked: counts.blocked,
    pending: counts.pending,
  };
}

async function ensureRevisionCached(
  userId: string,
  revisionId: string,
): Promise<{
  id: string;
  kitchenId: string;
  templateId: string;
  definitionJson: string;
  title: string;
}> {
  const cached = await getCachedRevision(userId, revisionId);
  if (cached) {
    return {
      id: cached.id,
      kitchenId: cached.kitchenId,
      templateId: cached.templateId,
      definitionJson: cached.definitionJson,
      title: cached.title,
    };
  }

  const { data, error } = await getSupabase()
    .from('kdo_template_revisions')
    .select('id, kitchen_id, template_id, version, published_at, definition')
    .eq('id', revisionId)
    .eq('owner_user_id', userId)
    .maybeSingle();
  if (error) throw error;
  if (!data) throw new Error('Published revision not found. Publish the template first.');

  const def = data.definition as { title?: string };
  await upsertCachedRevision({
    id: data.id,
    userId,
    kitchenId: data.kitchen_id,
    templateId: data.template_id,
    version: data.version,
    publishedAt: data.published_at,
    definitionJson: JSON.stringify(data.definition),
    title: def.title ?? 'Checklist',
  });

  return {
    id: data.id,
    kitchenId: data.kitchen_id,
    templateId: data.template_id,
    definitionJson: JSON.stringify(data.definition),
    title: def.title ?? 'Checklist',
  };
}

/** Resolve published revision id for a template (latest published). */
export async function getLatestPublishedRevisionId(
  userId: string,
  templateId: string,
): Promise<string | null> {
  const { data, error } = await getSupabase()
    .from('kdo_templates')
    .select('id, published_revision, state')
    .eq('id', templateId)
    .eq('owner_user_id', userId)
    .maybeSingle();
  if (error) throw error;
  if (!data || data.state === 'archived' || data.published_revision == null) {
    return null;
  }

  const { data: rev, error: revErr } = await getSupabase()
    .from('kdo_template_revisions')
    .select('id')
    .eq('template_id', templateId)
    .eq('owner_user_id', userId)
    .eq('version', data.published_revision)
    .maybeSingle();
  if (revErr) throw revErr;
  return rev?.id ?? null;
}

export async function createManualRun(input: {
  userId: string;
  kitchenId: string;
  templateRevisionId: string;
}): Promise<{ runId: string; offline: boolean }> {
  const zone = getDeviceTimeZone();
  const localDate = localDateString(nowLocal(zone));
  const runId = newId();
  const mutationId = newId();
  const occurrenceKey = manualOccurrenceKey(newId());
  const scheduledFor = new Date().toISOString();
  const dueAt =
    DateTime.fromISO(scheduledFor)
      .plus({ minutes: MANUAL_DUE_AFTER_MINUTES })
      .toUTC()
      .toISO() ?? scheduledFor;
  const reportedAt = scheduledFor;

  const rev = await ensureRevisionCached(input.userId, input.templateRevisionId);
  if (rev.kitchenId !== input.kitchenId) {
    throw new Error('Revision does not belong to this kitchen.');
  }

  const definition = parseTemplateDefinition(JSON.parse(rev.definitionJson));
  const material = materializeItemsFromDefinition(definition);
  const nowIso = new Date().toISOString();

  const db = await getLocalDb();
  await db.withTransactionAsync(async () => {
    await upsertCachedRun({
      id: runId,
      userId: input.userId,
      kitchenId: input.kitchenId,
      templateId: rev.templateId,
      templateRevisionId: rev.id,
      scheduleId: null,
      source: 'manual',
      occurrenceKey,
      titleSnapshot: definition.title,
      categoryIdSnapshot: definition.category_id ?? null,
      categoryNameSnapshot: definition.category_name ?? null,
      localDate,
      timezoneSnapshot: zone,
      scheduledFor,
      dueAt,
      state: 'not_started',
      revision: 1,
      completedAt: null,
      closedAt: null,
      updatedAt: nowIso,
      pendingCreate: true,
    });

    for (const m of material) {
      await upsertCachedRunItem({
        id: newId(),
        userId: input.userId,
        kitchenId: input.kitchenId,
        runId,
        sourceItemId: m.sourceItemId,
        sourceSectionId: m.sourceSectionId,
        sectionTitleSnapshot: m.sectionTitle,
        sectionOrderSnapshot: m.sectionOrder,
        titleSnapshot: m.title,
        instructionsSnapshot: m.instructions,
        responseTypeSnapshot: m.responseType,
        sortOrder: m.sortOrder,
        outcome: 'pending',
        note: null,
        recordedAt: null,
        revision: 1,
        updatedAt: nowIso,
      });
    }

    await enqueueOutbox({
      userId: input.userId,
      kitchenId: input.kitchenId,
      mutationId,
      operation: 'create_manual_run',
      reportedAt,
      payload: {
        template_revision_id: rev.id,
        run_id: runId,
        occurrence_key: occurrenceKey,
        local_date: localDate,
        timezone: zone,
        scheduled_for: scheduledFor,
        due_at: dueAt,
      },
    });
  });

  const flush = await flushOutbox(input.userId, input.kitchenId);
  if (!flush.offline && !flush.error) {
    await pullKitchenCache(input.userId, input.kitchenId, {
      fromDate: localDate,
      toDate: localDate,
    });
  }

  return { runId, offline: flush.offline || Boolean(flush.error) };
}

/**
 * Open unfinished run for a template (today first, then earlier unfinished).
 * Prevents stacking another Use now while one is still in progress.
 */
export async function findOpenRunForTemplate(
  userId: string,
  kitchenId: string,
  templateId: string,
): Promise<{ runId: string; localDate: string } | null> {
  const zone = getDeviceTimeZone();
  const today = localDateString(nowLocal(zone));
  const runs = await listCachedRunsForKitchen(userId, kitchenId);
  const open = runs.filter(
    (r) =>
      r.templateId === templateId &&
      r.state !== 'finished' &&
      r.state !== 'cancelled',
  );
  if (open.length === 0) return null;

  open.sort((a, b) => {
    if (a.localDate === today && b.localDate !== today) return -1;
    if (b.localDate === today && a.localDate !== today) return 1;
    return b.scheduledFor.localeCompare(a.scheduledFor);
  });

  const best = open[0];
  return { runId: best.id, localDate: best.localDate };
}

/**
 * Start a manual run for a template, or reopen the unfinished one.
 * At most one open run per template — never stacks another Use now.
 */
export async function startManualRunFromTemplate(input: {
  userId: string;
  kitchenId: string;
  templateId: string;
}): Promise<{ runId: string; offline: boolean; reused: boolean }> {
  const existing = await findOpenRunForTemplate(
    input.userId,
    input.kitchenId,
    input.templateId,
  );
  if (existing) {
    return { runId: existing.runId, offline: false, reused: true };
  }

  const revisionId = await getLatestPublishedRevisionId(
    input.userId,
    input.templateId,
  );
  if (!revisionId) {
    throw new Error('NO_PUBLISHED_REVISION');
  }
  const created = await createManualRun({
    userId: input.userId,
    kitchenId: input.kitchenId,
    templateRevisionId: revisionId,
  });
  return { ...created, reused: false };
}

export async function applyItemOutcome(input: {
  userId: string;
  kitchenId: string;
  runItemId: string;
  outcome: RunItemOutcome;
  note?: string | null;
}): Promise<void> {
  if (requiresExceptionNote(input.outcome)) {
    if (!input.note || !input.note.trim()) {
      throw new Error('Add a short note for this exception.');
    }
  }

  const item = await getCachedRunItem(input.userId, input.runItemId);
  if (!item) throw new Error('Item not found.');
  const run = await getCachedRun(input.userId, item.runId);
  if (!run) throw new Error('Run not found.');
  if (run.pendingCreate) {
    throw new Error('Still syncing this run. Try again in a moment.');
  }

  const mutationId = newId();
  const recordedAt = new Date().toISOString();
  const expectedRevision = item.revision;
  const note =
    input.outcome === 'pending'
      ? null
      : input.outcome === 'done'
        ? input.note?.trim() || null
        : input.note!.trim();

  const db = await getLocalDb();
  await db.withTransactionAsync(async () => {
    const nextItem = {
      ...item,
      outcome: input.outcome,
      note,
      recordedAt: input.outcome === 'pending' ? null : recordedAt,
      revision: item.revision + 1,
      updatedAt: recordedAt,
    };
    await upsertCachedRunItem(nextItem);

    if (input.outcome === 'blocked') {
      const issues = await listCachedIssuesForRun(input.userId, item.runId);
      const existing = issues.find((i) => i.runItemId === item.id);
      if (existing) {
        await upsertCachedIssue({
          ...existing,
          description: note ?? existing.description,
          state: 'open',
          resolutionNote: null,
          resolvedAt: null,
          reportedAt: recordedAt,
          revision: existing.revision + 1,
          updatedAt: recordedAt,
        });
      } else {
        await upsertCachedIssue({
          id: newId(),
          userId: input.userId,
          kitchenId: input.kitchenId,
          runId: item.runId,
          runItemId: item.id,
          description: note ?? 'Blocked',
          state: 'open',
          resolutionNote: null,
          reportedAt: recordedAt,
          resolvedAt: null,
          revision: 1,
          updatedAt: recordedAt,
        });
      }
    }

    const items = await listCachedItemsForRun(input.userId, item.runId);
    const counts = countOutcomes(
      items.map((i) => (i.id === item.id ? input.outcome : i.outcome)),
    );
    const nextState = reconcileRunState(run.state, counts);
    await upsertCachedRun({
      ...run,
      state: nextState,
      revision: run.revision + 1,
      completedAt: nextState === 'finished' ? recordedAt : null,
      closedAt: nextState === 'finished' ? recordedAt : null,
      updatedAt: recordedAt,
    });

    await enqueueOutbox({
      userId: input.userId,
      kitchenId: input.kitchenId,
      mutationId,
      operation: 'apply_item_outcome',
      reportedAt: recordedAt,
      payload: {
        run_item_id: item.id,
        expected_revision: expectedRevision,
        outcome: input.outcome,
        note,
        recorded_at: recordedAt,
      },
    });
  });

  if (run.state !== 'finished') {
    const updated = await getCachedRun(input.userId, run.id);
    if (updated?.state === 'finished') {
      await cancelReminderForOccurrence(
        input.userId,
        input.kitchenId,
        run.occurrenceKey,
      );
    }
  }

  await flushOutbox(input.userId, input.kitchenId);
}

export async function reopenItem(input: {
  userId: string;
  kitchenId: string;
  runItemId: string;
}): Promise<void> {
  await applyItemOutcome({
    ...input,
    outcome: 'pending',
    note: null,
  });
}

export async function resolveIssue(input: {
  userId: string;
  kitchenId: string;
  issueId: string;
  resolutionNote?: string | null;
}): Promise<void> {
  const issue = await getCachedIssue(input.userId, input.issueId);
  if (!issue) throw new Error('Issue not found.');
  if (issue.state === 'resolved') return;

  const mutationId = newId();
  const nowIso = new Date().toISOString();
  const expectedRevision = issue.revision;

  const db = await getLocalDb();
  await db.withTransactionAsync(async () => {
    await upsertCachedIssue({
      ...issue,
      state: 'resolved',
      resolutionNote: input.resolutionNote?.trim() || null,
      resolvedAt: nowIso,
      revision: issue.revision + 1,
      updatedAt: nowIso,
    });
    await enqueueOutbox({
      userId: input.userId,
      kitchenId: input.kitchenId,
      mutationId,
      operation: 'resolve_issue',
      reportedAt: nowIso,
      payload: {
        issue_id: issue.id,
        expected_revision: expectedRevision,
        resolution_note: input.resolutionNote?.trim() || null,
      },
    });
  });

  await flushOutbox(input.userId, input.kitchenId);
}

/** Soft-delete: mark cancelled so the run leaves Today and frees the template. */
export async function cancelRun(input: {
  userId: string;
  kitchenId: string;
  runId: string;
}): Promise<void> {
  const run = await getCachedRun(input.userId, input.runId);
  if (!run) throw new Error('Run not found.');
  if (run.kitchenId !== input.kitchenId) {
    throw new Error('Run does not belong to this kitchen.');
  }
  if (run.state === 'cancelled') return;
  if (run.state === 'finished') {
    throw new Error('Finished checklists cannot be deleted.');
  }

  const mutationId = newId();
  const nowIso = new Date().toISOString();
  const expectedRevision = run.revision;
  const items = await listCachedItemsForRun(input.userId, run.id);
  const itemIds = new Set(items.map((i) => i.id));

  const pending = await listPendingOutbox(input.userId, input.kitchenId);
  const createStillQueued = pending.some((row) => {
    if (row.operation !== 'create_manual_run') return false;
    try {
      const payload = JSON.parse(row.payloadJson) as { run_id?: string };
      return payload.run_id === run.id;
    } catch {
      return false;
    }
  });

  const db = await getLocalDb();
  await db.withTransactionAsync(async () => {
    await upsertCachedRun({
      ...run,
      state: 'cancelled',
      completedAt: null,
      closedAt: nowIso,
      revision: run.revision + 1,
      updatedAt: nowIso,
      pendingCreate: false,
    });

    if (createStillQueued) {
      // Never reached the server — drop create + item ops; no cancel_run needed.
      for (const row of pending) {
        let payload: Record<string, unknown> = {};
        try {
          payload = JSON.parse(row.payloadJson) as Record<string, unknown>;
        } catch {
          continue;
        }
        if (
          row.operation === 'create_manual_run' &&
          payload.run_id === run.id
        ) {
          await discardOutboxRow(row.id);
          continue;
        }
        if (
          row.operation === 'apply_item_outcome' &&
          typeof payload.run_item_id === 'string' &&
          itemIds.has(payload.run_item_id)
        ) {
          await discardOutboxRow(row.id);
          continue;
        }
        if (row.operation === 'cancel_run' && payload.run_id === run.id) {
          await discardOutboxRow(row.id);
        }
      }
      return;
    }

    await enqueueOutbox({
      userId: input.userId,
      kitchenId: input.kitchenId,
      mutationId,
      operation: 'cancel_run',
      reportedAt: nowIso,
      payload: {
        run_id: run.id,
        expected_revision: expectedRevision,
      },
    });
  });

  await cancelReminderForOccurrence(
    input.userId,
    input.kitchenId,
    run.occurrenceKey,
  );

  await flushOutbox(input.userId, input.kitchenId);
}

/**
 * Resolve a reminder tap to a run id. Materialises the occurrence if needed,
 * then returns the cached/server run for that occurrence_key.
 */
export async function openRunForOccurrence(input: {
  userId: string;
  kitchenId: string;
  occurrenceKey: string;
}): Promise<string | null> {
  const existing = await getCachedRunByOccurrenceKey(
    input.userId,
    input.kitchenId,
    input.occurrenceKey,
  );
  if (existing) return existing.id;

  const zone = getDeviceTimeZone();
  const today = localDateString(nowLocal(zone));
  const from = localDateString(nowLocal(zone).minus({ days: 7 }));
  const to = localDateString(nowLocal(zone).plus({ days: 14 }));

  await ensureScheduledOccurrences(input.kitchenId, from, to, zone);
  await pullKitchenCache(input.userId, input.kitchenId, {
    fromDate: from,
    toDate: today,
  });

  const after = await getCachedRunByOccurrenceKey(
    input.userId,
    input.kitchenId,
    input.occurrenceKey,
  );
  return after?.id ?? null;
}

export { rpcErrorMessage };
