import { DateTime } from 'luxon';

/**
 * Resolve a local wall-clock start on `localDate` (yyyy-MM-dd) at `hhmm` (HH:mm).
 *
 * DST rules (decisions.md):
 * - Nonexistent local time → next valid local instant
 * - Repeated local time (fall back) → earlier instant (one occurrence)
 *
 * Luxon `fromObject` / `fromISO` already prefer the earlier offset when a wall
 * time repeats; we only special-case spring-forward gaps.
 */
export function resolveLocalStart(
  localDate: string,
  hhmm: string,
  zone: string,
): DateTime {
  const match = /^(\d{2}):(\d{2})$/.exec(hhmm);
  if (!match) throw new Error(`Invalid local time: ${hhmm}`);
  const hour = Number(match[1]);
  const minute = Number(match[2]);

  const parts = localDate.split('-').map(Number);
  if (parts.length !== 3 || parts.some((n) => Number.isNaN(n))) {
    throw new Error(`Invalid local date: ${localDate}`);
  }
  const [year, month, day] = parts;

  const resolved = DateTime.fromObject(
    { year, month, day, hour, minute, second: 0, millisecond: 0 },
    { zone },
  );

  if (resolved.isValid) {
    return resolved;
  }

  // Nonexistent local time (spring forward): step forward to the next valid instant.
  let cursor = DateTime.fromObject(
    { year, month, day, hour: 0, minute: 0, second: 0, millisecond: 0 },
    { zone },
  );
  if (!cursor.isValid) {
    throw new Error(`Invalid local date: ${localDate}`);
  }

  cursor = cursor.plus({ minutes: hour * 60 + minute });

  for (let i = 0; i < 8; i += 1) {
    const wall = DateTime.fromObject(
      {
        year: cursor.year,
        month: cursor.month,
        day: cursor.day,
        hour: cursor.hour,
        minute: cursor.minute,
        second: 0,
        millisecond: 0,
      },
      { zone },
    );
    if (wall.isValid) return wall;
    cursor = cursor.plus({ minutes: 15 });
  }

  throw new Error(
    `Could not resolve local start ${localDate} ${hhmm} in ${zone}`,
  );
}
