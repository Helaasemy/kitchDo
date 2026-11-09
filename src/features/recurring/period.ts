import { DateTime } from 'luxon';

export type TaskFrequency = 'daily' | 'weekly' | 'monthly';

export const TASK_FREQUENCIES: TaskFrequency[] = ['daily', 'weekly', 'monthly'];

const UNIT = { daily: 'day', weekly: 'week', monthly: 'month' } as const;

/** Calendar period containing `now`: the day, the Monday–Sunday week, or the month. */
export function periodStart(frequency: TaskFrequency, now: DateTime): DateTime {
  return now.startOf(UNIT[frequency]);
}

export function periodEnd(frequency: TaskFrequency, now: DateTime): DateTime {
  return now.endOf(UNIT[frequency]);
}

/** A tick counts for one period; the key is stable for the whole period. */
export function periodKey(frequency: TaskFrequency, now: DateTime): string {
  return `${frequency}:${periodStart(frequency, now).toFormat('yyyy-MM-dd')}`;
}

export function parsePeriodKey(
  key: string,
): { frequency: TaskFrequency; start: string } | null {
  const match = /^(daily|weekly|monthly):(\d{4}-\d{2}-\d{2})$/.exec(key);
  if (!match) return null;
  return { frequency: match[1] as TaskFrequency, start: match[2] };
}

export function isTaskFrequency(value: unknown): value is TaskFrequency {
  return value === 'daily' || value === 'weekly' || value === 'monthly';
}
