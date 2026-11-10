import { resolveDueAt } from '@/lib/dates';
import {
  getSupabase,
  isMissingRpcError,
  rpcErrorMessage,
} from '@/lib/supabase';
import {
  countFailedOutbox,
  countPendingOutbox,
  getCachedRun,
  listPendingOutbox,
  markOutboxDone,
  markOutboxFailed,
  replaceCachedItemsForRun,
  setSyncMeta,
  upsertCachedIssue,
  upsertCachedRevision,
  upsertCachedRun,
  upsertCachedRunItem,
} from '@/lib/storage';
import type { OutboxRow } from '@/lib/storage';

import type { SyncStatus } from './types';

let flushing = false;

export async function buildSyncStatus(
  userId: string,
  kitchenId: string | null,
  opts?: { offline?: boolean; error?: string | null; syncing?: boolean },
): Promise<SyncStatus> {
  const pending = kitchenId
    ? await countPendingOutbox(userId, kitchenId)
    : await countPendingOutbox(userId);
  const failedCount = kitchenId
    ? await countFailedOutbox(userId, kitchenId)
    : await countFailedOutbox(userId);
  if (opts?.syncing || flushing) {
    return {
      kind: 'syncing',
      pendingCount: pending,
      failedCount,
      lastError: opts?.error ?? null,
      lastSyncedAt: null,
    };
  }
  if (opts?.offline) {
    return {
      kind: 'offline',
      pendingCount: pending,
      failedCount,
      lastError: opts.error ?? null,
      lastSyncedAt: null,
    };
  }
  if (opts?.error) {
    return {
      kind: 'error',
      pendingCount: pending,
      failedCount,
      lastError: opts.error,
      lastSyncedAt: null,
    };
  }
  if (pending > 0) {
    return {
      kind: 'changes_waiting',
      pendingCount: pending,
      failedCount,
      lastError: null,
      lastSyncedAt: null,
    };
  }
  return {
    kind: 'idle',
    pendingCount: 0,
    failedCount,
    lastError: null,
    lastSyncedAt: null,
  };
}

function isNetworkError(error: unknown): boolean {
  const msg = rpcErrorMessage(error, '').toLowerCase();
  return (
    msg.includes('network') ||
    msg.includes('fetch') ||
    msg.includes('failed to connect') ||
    msg.includes('offline') ||
    msg.includes('timed out')
  );
}

async function flushOne(row: OutboxRow): Promise<void> {
  const supabase = getSupabase();
  const payload = JSON.parse(row.payloadJson) as Record<string, unknown>;

  if (row.operation === 'create_manual_run') {
    const { error } = await supabase.rpc('create_manual_run', {
      p_mutation_id: row.mutationId,
      p_template_revision_id: String(payload.template_revision_id),
      p_run_id: String(payload.run_id),
      p_occurrence_key: String(payload.occurrence_key),
      p_local_date: String(payload.local_date),
      p_timezone: String(payload.timezone),
      p_scheduled_for: payload.scheduled_for
        ? String(payload.scheduled_for)
        : undefined,
    });
    if (error) throw error;

    const runId = String(payload.run_id);
    const run = await getCachedRun(row.userId, runId);
    if (run) {
      await upsertCachedRun({ ...run, pendingCreate: false });
    }

    // Server materializes its own item UUIDs — replace provisional local rows.
    const { data: items, error: itemsErr } = await supabase
      .from('kdo_run_items')
      .select('*')
      .eq('run_id', runId);
    if (itemsErr) throw itemsErr;
    await replaceCachedItemsForRun(
      row.userId,
      runId,
      (items ?? []).map((item) => ({
        id: item.id,
        userId: row.userId,
        kitchenId: item.kitchen_id,
        runId: item.run_id,
        sourceItemId: item.source_item_id,
        sourceSectionId: item.source_section_id,
        sectionTitleSnapshot: item.section_title_snapshot,
        sectionOrderSnapshot: item.section_order_snapshot,
        titleSnapshot: item.title_snapshot,
        instructionsSnapshot: item.instructions_snapshot,
        responseTypeSnapshot: item.response_type_snapshot,
        sortOrder: item.sort_order,
        outcome: item.outcome,
        note: item.note,
        recordedAt: item.recorded_at,
        revision: item.revision,
        updatedAt: item.updated_at,
      })),
    );
    return;
  }

  if (row.operation === 'apply_item_outcome') {
    const { error } = await supabase.rpc('apply_item_outcome', {
      p_mutation_id: row.mutationId,
      p_run_item_id: String(payload.run_item_id),
      p_expected_revision: Number(payload.expected_revision),
      p_outcome: String(payload.outcome),
      p_note: payload.note == null ? undefined : String(payload.note),
      p_recorded_at: payload.recorded_at
        ? String(payload.recorded_at)
        : undefined,
    });
    if (error) throw error;
    return;
  }

  if (row.operation === 'resolve_issue') {
    const { error } = await supabase.rpc('resolve_issue', {
      p_mutation_id: row.mutationId,
      p_issue_id: String(payload.issue_id),
      p_expected_revision: Number(payload.expected_revision),
      p_resolution_note: payload.resolution_note
        ? String(payload.resolution_note)
        : undefined,
    });
    if (error) throw error;
    return;
  }

  if (row.operation === 'cancel_run') {
    const runId = String(payload.run_id);
    const expectedRevision = Number(payload.expected_revision);
    const { error } = await supabase.rpc('cancel_run', {
      p_mutation_id: row.mutationId,
      p_run_id: runId,
      p_expected_revision: expectedRevision,
    });
    if (!error) return;

    // RPC not deployed yet — fall back to a direct RLS update so sync
    // is not stuck forever on a missing cancel_run function.
    if (!isMissingRpcError(error)) throw error;

    const nowIso = new Date().toISOString();
    const applyCancel = async (revision: number) => {
      const { data, error: updErr } = await supabase
        .from('kdo_runs')
        .update({
          state: 'cancelled',
          completed_at: null,
          closed_at: nowIso,
          revision: revision + 1,
          updated_at: nowIso,
        })
        .eq('id', runId)
        .eq('revision', revision)
        .select('id');
      if (updErr) throw updErr;
      return data ?? [];
    };

    let updated = await applyCancel(expectedRevision);
    if (updated.length === 0) {
      const { data: existing, error: getErr } = await supabase
        .from('kdo_runs')
        .select('id, state, revision')
        .eq('id', runId)
        .maybeSingle();
      if (getErr) throw getErr;
      if (!existing) {
        // Never created on server (create was abandoned) — done.
        return;
      }
      if (existing.state === 'cancelled') return;
      updated = await applyCancel(existing.revision);
      if (updated.length === 0) {
        throw new Error('Could not cancel checklist (revision conflict).');
      }
    }
    return;
  }

  throw new Error(`Unknown outbox operation: ${row.operation}`);
}

export type FlushResult = {
  flushed: number;
  offline: boolean;
  error: string | null;
  skipped?: boolean;
};

function isPermanentOutboxError(message: string): boolean {
  const lower = message.toLowerCase();
  return (
    lower.includes('revision') ||
    lower.includes('conflict') ||
    lower.includes('not found') ||
    lower.includes('does not exist')
  );
}

export async function flushOutbox(
  userId: string,
  kitchenId: string,
): Promise<FlushResult> {
  if (flushing) {
    return { flushed: 0, offline: false, error: null, skipped: true };
  }
  flushing = true;
  let flushed = 0;
  let offline = false;
  let lastError: string | null = null;

  try {
    const pending = await listPendingOutbox(userId, kitchenId);
    for (const row of pending) {
      try {
        await flushOne(row);
        await markOutboxDone(row.id);
        flushed += 1;
      } catch (e) {
        const message = rpcErrorMessage(e);
        const permanent = isPermanentOutboxError(message);
        await markOutboxFailed(row.id, message, { permanent });
        if (isNetworkError(e)) {
          offline = true;
          lastError = message;
          break;
        }
        lastError = message;
        if (permanent) continue;
        break;
      }
    }
    if (flushed > 0) {
      await setSyncMeta(
        userId,
        kitchenId,
        'last_flush_at',
        new Date().toISOString(),
      );
    }
  } finally {
    flushing = false;
  }

  return { flushed, offline, error: lastError };
}

/** Pull server runs/items/issues/revisions into SQLite for offline use. */
export async function pullKitchenCache(
  userId: string,
  kitchenId: string,
  opts?: { fromDate?: string; toDate?: string },
): Promise<{ offline: boolean; error: string | null }> {
  const supabase = getSupabase();
  try {
    const revQuery = supabase
      .from('kdo_template_revisions')
      .select('id, kitchen_id, template_id, version, published_at, definition')
      .eq('kitchen_id', kitchenId)
      .order('published_at', { ascending: false })
      .limit(100);

    const { data: revisions, error: revErr } = await revQuery;
    if (revErr) throw revErr;

    for (const rev of revisions ?? []) {
      const def = rev.definition as { title?: string };
      await upsertCachedRevision({
        id: rev.id,
        userId,
        kitchenId: rev.kitchen_id,
        templateId: rev.template_id,
        version: rev.version,
        publishedAt: rev.published_at,
        definitionJson: JSON.stringify(rev.definition),
        title: def.title ?? 'Checklist',
      });
    }

    let runsQuery = supabase
      .from('kdo_runs')
      .select('*')
      .eq('kitchen_id', kitchenId)
      .order('local_date', { ascending: false })
      .limit(200);

    if (opts?.fromDate) {
      runsQuery = runsQuery.gte('local_date', opts.fromDate);
    }
    if (opts?.toDate) {
      runsQuery = runsQuery.lte('local_date', opts.toDate);
    }

    const { data: runs, error: runsErr } = await runsQuery;
    if (runsErr) throw runsErr;

    const runIds = (runs ?? []).map((r) => r.id);
    const pendingCancelIds = new Set<string>();
    const pendingRunIds = new Set<string>();
    const pendingItemIds = new Set<string>();
    const pendingIssueIds = new Set<string>();
    for (const row of await listPendingOutbox(userId, kitchenId)) {
      try {
        const payload = JSON.parse(row.payloadJson) as {
          run_id?: string;
          run_item_id?: string;
          issue_id?: string;
        };
        if (row.operation === 'cancel_run' && payload.run_id) {
          pendingCancelIds.add(payload.run_id);
          pendingRunIds.add(payload.run_id);
        }
        if (row.operation === 'create_manual_run' && payload.run_id) {
          pendingRunIds.add(payload.run_id);
        }
        if (row.operation === 'apply_item_outcome' && payload.run_item_id) {
          pendingItemIds.add(payload.run_item_id);
        }
        if (row.operation === 'resolve_issue' && payload.issue_id) {
          pendingIssueIds.add(payload.issue_id);
        }
      } catch {
        /* ignore malformed */
      }
    }

    for (const run of runs ?? []) {
      if (pendingRunIds.has(run.id) && !pendingCancelIds.has(run.id)) continue;
      const local = await getCachedRun(userId, run.id);
      if (local && local.revision > run.revision && !pendingCancelIds.has(run.id)) {
        continue;
      }
      // Prefer local cancelled while cancel_run is still queued so refresh
      // does not resurrect a checklist the user just deleted.
      const cancelledPending = pendingCancelIds.has(run.id);
      await upsertCachedRun({
        id: run.id,
        userId,
        kitchenId: run.kitchen_id,
        templateId: run.template_id,
        templateRevisionId: run.template_revision_id,
        scheduleId: run.schedule_id,
        source: run.source,
        occurrenceKey: run.occurrence_key,
        titleSnapshot: run.title_snapshot,
        categoryIdSnapshot: run.category_id_snapshot,
        categoryNameSnapshot: run.category_name_snapshot,
        localDate: run.local_date,
        timezoneSnapshot: run.timezone_snapshot,
        scheduledFor: run.scheduled_for,
        dueAt: resolveDueAt(run.due_at, run.scheduled_for),
        state: cancelledPending ? 'cancelled' : run.state,
        revision: cancelledPending
          ? Math.max(run.revision, local?.revision ?? run.revision)
          : run.revision,
        completedAt: cancelledPending ? null : run.completed_at,
        closedAt: cancelledPending
          ? (local?.closedAt ?? run.closed_at ?? new Date().toISOString())
          : run.closed_at,
        updatedAt: run.updated_at,
        pendingCreate: false,
      });
    }

    if (runIds.length > 0) {
      const { data: items, error: itemsErr } = await supabase
        .from('kdo_run_items')
        .select('*')
        .in('run_id', runIds);
      if (itemsErr) throw itemsErr;

      for (const item of items ?? []) {
        if (pendingItemIds.has(item.id) || pendingRunIds.has(item.run_id)) continue;
        await upsertCachedRunItem({
          id: item.id,
          userId,
          kitchenId: item.kitchen_id,
          runId: item.run_id,
          sourceItemId: item.source_item_id,
          sourceSectionId: item.source_section_id,
          sectionTitleSnapshot: item.section_title_snapshot,
          sectionOrderSnapshot: item.section_order_snapshot,
          titleSnapshot: item.title_snapshot,
          instructionsSnapshot: item.instructions_snapshot,
          responseTypeSnapshot: item.response_type_snapshot,
          sortOrder: item.sort_order,
          outcome: item.outcome,
          note: item.note,
          recordedAt: item.recorded_at,
          revision: item.revision,
          updatedAt: item.updated_at,
        });
      }

      const { data: issues, error: issuesErr } = await supabase
        .from('kdo_issues')
        .select('*')
        .in('run_id', runIds);
      if (issuesErr) throw issuesErr;

      for (const issue of issues ?? []) {
        if (pendingIssueIds.has(issue.id) || pendingRunIds.has(issue.run_id)) continue;
        await upsertCachedIssue({
          id: issue.id,
          userId,
          kitchenId: issue.kitchen_id,
          runId: issue.run_id,
          runItemId: issue.run_item_id,
          description: issue.description,
          state: issue.state,
          resolutionNote: issue.resolution_note,
          reportedAt: issue.reported_at,
          resolvedAt: issue.resolved_at,
          revision: issue.revision,
          updatedAt: issue.updated_at,
        });
      }
    }

    await setSyncMeta(
      userId,
      kitchenId,
      'last_pull_at',
      new Date().toISOString(),
    );
    return { offline: false, error: null };
  } catch (e) {
    return {
      offline: isNetworkError(e),
      error: rpcErrorMessage(e),
    };
  }
}

export async function ensureScheduledOccurrences(
  kitchenId: string,
  fromDate: string,
  toDate: string,
  timezone: string,
): Promise<{ created: number; skipped: number; offline: boolean; error: string | null }> {
  try {
    const { data, error } = await getSupabase().rpc(
      'ensure_scheduled_occurrences',
      {
        p_kitchen_id: kitchenId,
        p_from_date: fromDate,
        p_to_date: toDate,
        p_timezone: timezone,
      },
    );
    if (error) throw error;
    const result = (data ?? {}) as { created?: number; skipped?: number };
    return {
      created: Number(result.created ?? 0),
      skipped: Number(result.skipped ?? 0),
      offline: false,
      error: null,
    };
  } catch (e) {
    return {
      created: 0,
      skipped: 0,
      offline: isNetworkError(e),
      error: rpcErrorMessage(e),
    };
  }
}
