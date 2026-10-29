export type RunItemOutcome =
  | 'pending'
  | 'done'
  | 'not_applicable'
  | 'blocked';

export type RunState = 'not_started' | 'in_progress' | 'finished' | 'cancelled';

export type OutcomeCounts = {
  total: number;
  pending: number;
  done: number;
  notApplicable: number;
  blocked: number;
};

export function countOutcomes(
  outcomes: Iterable<RunItemOutcome | string>,
): OutcomeCounts {
  const counts: OutcomeCounts = {
    total: 0,
    pending: 0,
    done: 0,
    notApplicable: 0,
    blocked: 0,
  };
  for (const outcome of outcomes) {
    counts.total += 1;
    if (outcome === 'pending') counts.pending += 1;
    else if (outcome === 'done') counts.done += 1;
    else if (outcome === 'not_applicable') counts.notApplicable += 1;
    else if (outcome === 'blocked') counts.blocked += 1;
  }
  return counts;
}

/** Mirrors `kdo_reconcile_run_progress` (non-cancelled). */
export function reconcileRunState(
  current: RunState | string,
  counts: OutcomeCounts,
): RunState {
  if (current === 'cancelled') return 'cancelled';
  if (counts.total === 0) return 'finished';
  if (counts.pending === counts.total) return 'not_started';
  if (counts.pending === 0) return 'finished';
  return 'in_progress';
}

export function outcomeSummaryLabel(counts: OutcomeCounts): string {
  const parts: string[] = [];
  if (counts.done) parts.push(`${counts.done} done`);
  if (counts.notApplicable) parts.push(`${counts.notApplicable} not applicable`);
  if (counts.blocked) parts.push(`${counts.blocked} blocked`);
  if (counts.pending) parts.push(`${counts.pending} open`);
  return parts.length ? parts.join(' · ') : 'No items';
}

export function requiresExceptionNote(outcome: RunItemOutcome): boolean {
  return outcome === 'not_applicable' || outcome === 'blocked';
}
