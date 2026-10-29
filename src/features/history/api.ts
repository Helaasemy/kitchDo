import {
  countOutcomes,
  outcomeSummaryLabel,
} from '@/domain/runProgress';
import {
  listCachedItemsForRuns,
  listCachedRunsForKitchen,
} from '@/lib/storage';

import { getRunDetail } from '@/features/runs/api';
import type { RunDetail } from '@/features/runs/types';

export type HistoryRow = {
  id: string;
  title: string;
  localDate: string;
  state: string;
  done: number;
  notApplicable: number;
  blocked: number;
  pending: number;
  summary: string;
  categoryName: string | null;
  categoryId: string | null;
};

export type HistoryFilter = {
  state?: 'all' | 'finished' | 'unfinished';
  categoryId?: string | null;
  from?: string;
  to?: string;
};

export async function listHistory(
  userId: string,
  kitchenId: string,
  opts: HistoryFilter = {},
): Promise<HistoryRow[]> {
  const runs = await listCachedRunsForKitchen(userId, kitchenId);
  const filtered = runs.filter((run) => {
    if (opts.from && run.localDate < opts.from) return false;
    if (opts.to && run.localDate > opts.to) return false;
    if (opts.state === 'finished' && run.state !== 'finished') return false;
    if (
      opts.state === 'unfinished' &&
      (run.state === 'finished' || run.state === 'cancelled')
    ) {
      return false;
    }
    if (
      opts.categoryId !== undefined &&
      opts.categoryId !== null &&
      run.categoryIdSnapshot !== opts.categoryId
    ) {
      return false;
    }
    return true;
  });

  const items = await listCachedItemsForRuns(
    userId,
    filtered.map((r) => r.id),
  );
  const byRun = new Map<string, string[]>();
  for (const item of items) {
    const list = byRun.get(item.runId) ?? [];
    list.push(item.outcome);
    byRun.set(item.runId, list);
  }

  return filtered.map((run) => {
    const counts = countOutcomes(byRun.get(run.id) ?? []);
    return {
      id: run.id,
      title: run.titleSnapshot,
      localDate: run.localDate,
      state: run.state,
      done: counts.done,
      notApplicable: counts.notApplicable,
      blocked: counts.blocked,
      pending: counts.pending,
      summary: outcomeSummaryLabel(counts),
      categoryName: run.categoryNameSnapshot,
      categoryId: run.categoryIdSnapshot,
    };
  });
}

export async function getHistoryDetail(
  userId: string,
  runId: string,
): Promise<RunDetail | null> {
  return getRunDetail(userId, runId);
}
