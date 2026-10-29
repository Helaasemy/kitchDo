import type { DateTime } from 'luxon';

import { localDateString } from './timezone';

/**
 * Scheduled occurrence key — stable across retries/DST.
 * Format: `{series_id}:{local_date}:{HH:mm}`
 */
export function scheduledOccurrenceKey(
  seriesId: string,
  localDate: string,
  hhmm: string,
): string {
  return `${seriesId}:${localDate}:${hhmm}`;
}

/** Manual runs keep `manual:{uuid}` through outbox retries. */
export function manualOccurrenceKey(uuid: string): string {
  return `manual:${uuid}`;
}

/**
 * Midnight rule: a run belongs to the local start date, not the due date.
 */
export function runLocalStartDate(startLocal: DateTime): string {
  return localDateString(startLocal);
}
