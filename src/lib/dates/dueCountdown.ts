import { DateTime } from 'luxon';

export type DueUrgency = 'none' | 'soon' | 'overdue';

export type DueCountdown = {
  label: string | null;
  /** Compact label for the ring center, e.g. `45m`, `2h`. */
  shortLabel: string | null;
  urgency: DueUrgency;
  remainingMs: number | null;
  /** 1 = full time left, 0 = due/overdue. */
  progress: number;
};

const ONE_HOUR_MS = 60 * 60 * 1000;

function formatDuration(ms: number): string {
  const totalMinutes = Math.max(0, Math.ceil(ms / 60_000));
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (hours <= 0) return `${minutes}m`;
  if (minutes === 0) return `${hours}h`;
  return `${hours}h ${minutes}m`;
}

function formatShort(ms: number): string {
  const totalMinutes = Math.max(0, Math.ceil(ms / 60_000));
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (hours <= 0) return `${minutes}m`;
  if (hours < 10 && minutes > 0) return `${hours}h${minutes}`;
  return `${hours}h`;
}

/** Default due window for manual Use-now runs (no schedule due_at). */
export const MANUAL_DUE_AFTER_MINUTES = 60;

/** Resolve due timestamp; manual runs without due_at get scheduledFor + 60m. */
export function resolveDueAt(
  dueAt: string | null | undefined,
  scheduledFor?: string | null,
): string | null {
  if (dueAt) return dueAt;
  if (!scheduledFor) return null;
  const start = DateTime.fromISO(scheduledFor, { setZone: true });
  if (!start.isValid) return null;
  return start.plus({ minutes: MANUAL_DUE_AFTER_MINUTES }).toUTC().toISO();
}

/**
 * Live due countdown. Under 1h remaining → soon (green). Past due → overdue (red).
 */
export function getDueCountdown(
  dueAt: string | null | undefined,
  opts: {
    dueIn: string;
    overdueBy: string;
    now?: DateTime;
    finished?: boolean;
    scheduledFor?: string | null;
  },
): DueCountdown {
  if (opts.finished) {
    return {
      label: null,
      shortLabel: null,
      urgency: 'none',
      remainingMs: null,
      progress: 0,
    };
  }

  const resolvedDueAt = resolveDueAt(dueAt, opts.scheduledFor);
  if (!resolvedDueAt) {
    return {
      label: null,
      shortLabel: null,
      urgency: 'none',
      remainingMs: null,
      progress: 0,
    };
  }

  // Prefer absolute instants — timestamptz from Supabase / SQLite may omit zone.
  const due = DateTime.fromISO(resolvedDueAt, { setZone: true });
  if (!due.isValid) {
    return {
      label: null,
      shortLabel: null,
      urgency: 'none',
      remainingMs: null,
      progress: 0,
    };
  }

  const now = (opts.now ?? DateTime.now()).toUTC();
  const dueUtc = due.toUTC();
  const remainingMs = dueUtc.toMillis() - now.toMillis();

  let windowMs = ONE_HOUR_MS;
  if (opts.scheduledFor) {
    const start = DateTime.fromISO(opts.scheduledFor, { setZone: true });
    if (start.isValid) {
      windowMs = Math.max(dueUtc.toMillis() - start.toUTC().toMillis(), 60_000);
    }
  }

  if (remainingMs < 0) {
    return {
      label: opts.overdueBy.replace('{time}', formatDuration(-remainingMs)),
      shortLabel: formatShort(-remainingMs),
      urgency: 'overdue',
      remainingMs,
      progress: 0,
    };
  }

  const progress = Math.min(1, Math.max(0, remainingMs / windowMs));

  return {
    label: opts.dueIn.replace('{time}', formatDuration(remainingMs)),
    shortLabel: formatShort(remainingMs),
    urgency: remainingMs <= ONE_HOUR_MS ? 'soon' : 'none',
    remainingMs,
    progress,
  };
}
