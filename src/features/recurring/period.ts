import { DateTime } from 'luxon';

export type RepeatFrequency = 'daily' | 'weekly' | 'monthly';
export type TaskFrequency = RepeatFrequency | 'once';

/** Repeating periods shown as Today / Weekly / Monthly. */
export const TASK_FREQUENCIES: RepeatFrequency[] = ['daily', 'weekly', 'monthly'];

/** Every section on Today, including one-off tasks. */
export const TODAY_FREQUENCIES: TaskFrequency[] = [...TASK_FREQUENCIES, 'once'];

const UNIT = { daily: 'day', weekly: 'week', monthly: 'month' } as const;

/** Calendar period containing `now`: the day, the Monday–Sunday week, or the month. */
export function periodStart(frequency: RepeatFrequency, now: DateTime): DateTime {
  return now.startOf(UNIT[frequency]);
}

export function periodEnd(frequency: RepeatFrequency, now: DateTime): DateTime {
  return now.endOf(UNIT[frequency]);
}

/** A tick counts for one period; one-off ticks are permanent. */
export function periodKey(
  frequency: TaskFrequency,
  now: DateTime,
  itemId?: string,
): string {
  if (frequency === 'once') return `once:${itemId ?? 'item'}`;
  return `${frequency}:${periodStart(frequency, now).toFormat('yyyy-MM-dd')}`;
}

export function parsePeriodKey(
  key: string,
): { frequency: TaskFrequency; start: string } | null {
  const once = /^once:(.+)$/.exec(key);
  if (once) return { frequency: 'once', start: once[1] };
  const match = /^(daily|weekly|monthly):(\d{4}-\d{2}-\d{2})$/.exec(key);
  if (!match) return null;
  return { frequency: match[1] as RepeatFrequency, start: match[2] };
}

export function isRepeatFrequency(value: unknown): value is RepeatFrequency {
  return value === 'daily' || value === 'weekly' || value === 'monthly';
}

export function isTaskFrequency(value: unknown): value is TaskFrequency {
  return isRepeatFrequency(value) || value === 'once';
}
