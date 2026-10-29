import { DateTime } from 'luxon';
import * as Localization from 'expo-localization';

/** Device IANA zone; falls back safely if the OS omits one. */
export function getDeviceTimeZone(): string {
  const zone =
    Localization.getCalendars()[0]?.timeZone ??
    Intl.DateTimeFormat().resolvedOptions().timeZone;
  if (zone && DateTime.now().setZone(zone).isValid) return zone;
  return 'UTC';
}

export function nowLocal(zone = getDeviceTimeZone()): DateTime {
  return DateTime.now().setZone(zone);
}

export function localDateString(
  dt: DateTime = nowLocal(),
): string {
  return dt.toISODate() ?? dt.toFormat('yyyy-MM-dd');
}

/** Never derive calendar dates by slicing a UTC ISO string. */
export function toUtcIso(dt: DateTime): string {
  const iso = dt.toUTC().toISO();
  if (!iso) throw new Error('Invalid DateTime for UTC ISO');
  return iso;
}
