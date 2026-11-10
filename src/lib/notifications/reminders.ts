import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { DateTime } from 'luxon';

import { getDeviceTimeZone, resolveLocalStart } from '@/lib/dates';
import { scheduledOccurrenceKey } from '@/lib/dates/occurrence';
import { getLocalDb } from '@/lib/storage';
import { getSupabase } from '@/lib/supabase';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: false,
    shouldSetBadge: false,
  }),
});

/** iOS pending notification practical bound. */
const HORIZON_DAYS = 7;
const MAX_PENDING = 48;

export type ReminderPrefs = {
  enabled: boolean;
};

export async function getNotificationPermission(): Promise<
  Notifications.PermissionStatus
> {
  const current = await Notifications.getPermissionsAsync();
  return current.status;
}

export async function requestNotificationPermission(): Promise<boolean> {
  const current = await Notifications.getPermissionsAsync();
  if (current.granted) return true;
  const asked = await Notifications.requestPermissionsAsync();
  return asked.granted;
}

async function listMapped(
  userId: string,
  kitchenId: string,
): Promise<{ occurrenceKey: string; notificationId: string }[]> {
  const db = await getLocalDb();
  const rows = await db.getAllAsync<{
    occurrence_key: string;
    notification_id: string;
  }>(
    `SELECT occurrence_key, notification_id FROM notification_map
     WHERE user_id = ? AND kitchen_id = ?`,
    userId,
    kitchenId,
  );
  return rows.map((r) => ({
    occurrenceKey: r.occurrence_key,
    notificationId: r.notification_id,
  }));
}

async function upsertMap(
  userId: string,
  kitchenId: string,
  occurrenceKey: string,
  notificationId: string,
  fireAt: string,
): Promise<void> {
  const db = await getLocalDb();
  await db.runAsync(
    `INSERT INTO notification_map (user_id, kitchen_id, occurrence_key, notification_id, fire_at)
     VALUES (?, ?, ?, ?, ?)
     ON CONFLICT(user_id, kitchen_id, occurrence_key) DO UPDATE SET
       notification_id = excluded.notification_id,
       fire_at = excluded.fire_at`,
    userId,
    kitchenId,
    occurrenceKey,
    notificationId,
    fireAt,
  );
}

async function deleteMapKey(
  userId: string,
  kitchenId: string,
  occurrenceKey: string,
): Promise<void> {
  const db = await getLocalDb();
  await db.runAsync(
    `DELETE FROM notification_map
     WHERE user_id = ? AND kitchen_id = ? AND occurrence_key = ?`,
    userId,
    kitchenId,
    occurrenceKey,
  );
}

export async function cancelAllMappedReminders(
  userId: string,
  kitchenId?: string | null,
): Promise<void> {
  const db = await getLocalDb();
  const rows = kitchenId
    ? await db.getAllAsync<{ notification_id: string; occurrence_key: string }>(
        `SELECT notification_id, occurrence_key FROM notification_map
         WHERE user_id = ? AND kitchen_id = ?`,
        userId,
        kitchenId,
      )
    : await db.getAllAsync<{ notification_id: string; occurrence_key: string }>(
        `SELECT notification_id, occurrence_key FROM notification_map WHERE user_id = ?`,
        userId,
      );

  for (const row of rows) {
    try {
      await Notifications.cancelScheduledNotificationAsync(row.notification_id);
    } catch {
      /* already gone */
    }
  }

  if (kitchenId) {
    await db.runAsync(
      `DELETE FROM notification_map WHERE user_id = ? AND kitchen_id = ?`,
      userId,
      kitchenId,
    );
  } else {
    await db.runAsync(`DELETE FROM notification_map WHERE user_id = ?`, userId);
  }
}

export async function cancelReminderForOccurrence(
  userId: string,
  kitchenId: string,
  occurrenceKey: string,
): Promise<void> {
  const db = await getLocalDb();
  const row = await db.getFirstAsync<{ notification_id: string }>(
    `SELECT notification_id FROM notification_map
     WHERE user_id = ? AND kitchen_id = ? AND occurrence_key = ?`,
    userId,
    kitchenId,
    occurrenceKey,
  );
  if (row) {
    try {
      await Notifications.cancelScheduledNotificationAsync(row.notification_id);
    } catch {
      /* ignore */
    }
  }
  await deleteMapKey(userId, kitchenId, occurrenceKey);
}

type Planned = {
  occurrenceKey: string;
  title: string;
  fireAt: DateTime;
  runIdHint?: string;
};

function isoDow(dt: DateTime): number {
  return dt.weekday; // Luxon: Mon=1 .. Sun=7
}

/**
 * Reconcile local notifications from active reminder-enabled schedules.
 * Bounded rolling horizon; cancels stale mapped IDs.
 */
export async function reconcileReminders(input: {
  userId: string;
  kitchenId: string;
  enabled: boolean;
}): Promise<{ scheduled: number; cancelled: number }> {
  if (!input.enabled || Platform.OS === 'web') {
    await cancelAllMappedReminders(input.userId, input.kitchenId);
    return { scheduled: 0, cancelled: 0 };
  }

  const granted = await requestNotificationPermission();
  if (!granted) {
    await cancelAllMappedReminders(input.userId, input.kitchenId);
    return { scheduled: 0, cancelled: 0 };
  }

  const zone = getDeviceTimeZone();
  const now = DateTime.now().setZone(zone);
  const supabase = getSupabase();

  const { data: schedules, error } = await supabase
    .from('kdo_schedules')
    .select(
      'id, series_id, template_id, weekdays, local_start_time, due_after_minutes, reminder_enabled, reminder_lead_minutes, effective_from, effective_until',
    )
    .eq('kitchen_id', input.kitchenId)
    .eq('reminder_enabled', true)
    .is('effective_until', null);

  if (error) throw error;

  const { data: templates } = await supabase
    .from('kdo_templates')
    .select('id, title, state')
    .eq('kitchen_id', input.kitchenId);

  const titleByTemplate = new Map(
    (templates ?? [])
      .filter((t) => t.state === 'active')
      .map((t) => [t.id, t.title] as const),
  );

  const { data: existingRuns } = await supabase
    .from('kdo_runs')
    .select('occurrence_key, state')
    .eq('kitchen_id', input.kitchenId)
    .gte('local_date', now.toISODate() ?? '')
    .lte(
      'local_date',
      now.plus({ days: HORIZON_DAYS }).toISODate() ?? '',
    );

  const finishedKeys = new Set(
    (existingRuns ?? [])
      .filter((r) => r.state === 'finished' || r.state === 'cancelled')
      .map((r) => r.occurrence_key),
  );

  const planned: Planned[] = [];

  for (let dayOffset = 0; dayOffset <= HORIZON_DAYS; dayOffset += 1) {
    const day = now.startOf('day').plus({ days: dayOffset });
    const localDate = day.toISODate();
    if (!localDate) continue;
    const dow = isoDow(day);

    for (const sched of schedules ?? []) {
      if (!titleByTemplate.has(sched.template_id)) continue;
      if (!sched.weekdays.includes(dow)) continue;

      const hhmm = String(sched.local_start_time).slice(0, 5);
      const start = resolveLocalStart(localDate, hhmm, zone);
      const lead = Math.max(0, sched.reminder_lead_minutes ?? 0);
      const fireAt = start.minus({ minutes: lead });
      if (fireAt <= now) continue;

      const effectiveFrom = DateTime.fromISO(sched.effective_from, { zone: 'utc' });
      if (start.toUTC() < effectiveFrom) continue;
      if (sched.effective_until) {
        const until = DateTime.fromISO(sched.effective_until, { zone: 'utc' });
        if (start.toUTC() >= until) continue;
      }

      const key = scheduledOccurrenceKey(sched.series_id, localDate, hhmm);
      if (finishedKeys.has(key)) continue;

      planned.push({
        occurrenceKey: key,
        title: titleByTemplate.get(sched.template_id) ?? 'Checklist',
        fireAt,
      });
    }
  }

  planned.sort((a, b) => a.fireAt.toMillis() - b.fireAt.toMillis());
  const bounded = planned.slice(0, MAX_PENDING);
  const wanted = new Set(bounded.map((p) => p.occurrenceKey));

  const existing = await listMapped(input.userId, input.kitchenId);
  let cancelled = 0;
  for (const row of existing) {
    if (!wanted.has(row.occurrenceKey)) {
      try {
        await Notifications.cancelScheduledNotificationAsync(row.notificationId);
      } catch {
        /* ignore */
      }
      await deleteMapKey(input.userId, input.kitchenId, row.occurrenceKey);
      cancelled += 1;
    }
  }

  const existingByKey = new Map(
    (await listMapped(input.userId, input.kitchenId)).map((r) => [
      r.occurrenceKey,
      r.notificationId,
    ]),
  );

  let scheduled = 0;
  for (const plan of bounded) {
    if (existingByKey.has(plan.occurrenceKey)) {
      scheduled += 1;
      continue;
    }
    const id = await Notifications.scheduleNotificationAsync({
      content: {
        title: plan.title,
        body: 'Time for your checklist.',
        data: { occurrenceKey: plan.occurrenceKey, kitchenId: input.kitchenId },
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DATE,
        date: plan.fireAt.toJSDate(),
      },
    });
    await upsertMap(
      input.userId,
      input.kitchenId,
      plan.occurrenceKey,
      id,
      plan.fireAt.toUTC().toISO() ?? '',
    );
    scheduled += 1;
  }

  return { scheduled, cancelled };
}
