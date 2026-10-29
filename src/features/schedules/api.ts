import { newId } from '@/lib/ids';
import { getSupabase, rpcErrorMessage } from '@/lib/supabase';

/** ISO weekdays: 1=Mon … 7=Sun (matches `kdo_schedules` check). */
export type Weekday = 1 | 2 | 3 | 4 | 5 | 6 | 7;

export type Schedule = {
  id: string;
  seriesId: string;
  templateId: string;
  kitchenId: string;
  weekdays: Weekday[];
  localStartTime: string;
  dueAfterMinutes: number;
  effectiveFrom: string;
  effectiveUntil: string | null;
  reminderEnabled: boolean;
  reminderLeadMinutes: number;
};

function mapSchedule(row: {
  id: string;
  series_id: string;
  template_id: string;
  kitchen_id: string;
  weekdays: number[];
  local_start_time: string;
  due_after_minutes: number;
  effective_from: string;
  effective_until: string | null;
  reminder_enabled: boolean;
  reminder_lead_minutes: number;
}): Schedule {
  return {
    id: row.id,
    seriesId: row.series_id,
    templateId: row.template_id,
    kitchenId: row.kitchen_id,
    weekdays: row.weekdays as Weekday[],
    localStartTime: row.local_start_time.slice(0, 8),
    dueAfterMinutes: row.due_after_minutes,
    effectiveFrom: row.effective_from,
    effectiveUntil: row.effective_until,
    reminderEnabled: row.reminder_enabled,
    reminderLeadMinutes: row.reminder_lead_minutes,
  };
}

export async function listActiveSchedulesForTemplate(
  templateId: string,
): Promise<Schedule[]> {
  const { data, error } = await getSupabase()
    .from('kdo_schedules')
    .select(
      'id, series_id, template_id, kitchen_id, weekdays, local_start_time, due_after_minutes, effective_from, effective_until, reminder_enabled, reminder_lead_minutes',
    )
    .eq('template_id', templateId)
    .is('effective_until', null)
    .order('local_start_time', { ascending: true });

  if (error) throw new Error(rpcErrorMessage(error, 'Could not load schedules.'));
  return (data ?? []).map(mapSchedule);
}

export async function reviseSchedule(input: {
  templateId: string;
  seriesId?: string;
  weekdays: Weekday[];
  localStartTime: string;
  dueAfterMinutes: number;
  reminderEnabled: boolean;
  reminderLeadMinutes: number;
  effectiveFrom?: string;
}): Promise<{ scheduleId: string; seriesId: string }> {
  if (input.weekdays.length === 0) {
    throw new Error('Pick at least one weekday.');
  }
  if (input.dueAfterMinutes < 1) {
    throw new Error('Due window must be at least 1 minute.');
  }

  const seriesId = input.seriesId ?? newId();
  const time = normalizeLocalTime(input.localStartTime);

  const { data, error } = await getSupabase().rpc('revise_schedule', {
    p_mutation_id: newId(),
    p_template_id: input.templateId,
    p_series_id: seriesId,
    p_weekdays: input.weekdays,
    p_local_start_time: time,
    p_due_after_minutes: input.dueAfterMinutes,
    p_effective_from: input.effectiveFrom ?? new Date().toISOString(),
    p_reminder_enabled: input.reminderEnabled,
    p_reminder_lead_minutes: input.reminderEnabled
      ? Math.max(0, input.reminderLeadMinutes)
      : 0,
    p_new_schedule_id: newId(),
  });

  if (error) throw new Error(rpcErrorMessage(error, 'Could not save schedule.'));

  const result = (data ?? {}) as { schedule_id?: string; series_id?: string };
  return {
    scheduleId: result.schedule_id ?? '',
    seriesId: result.series_id ?? seriesId,
  };
}

export async function pauseSchedule(input: {
  seriesId: string;
  effectiveUntil?: string;
}): Promise<void> {
  const { error } = await getSupabase().rpc('pause_schedule', {
    p_mutation_id: newId(),
    p_series_id: input.seriesId,
    p_effective_until: input.effectiveUntil ?? new Date().toISOString(),
  });
  if (error) throw new Error(rpcErrorMessage(error, 'Could not pause schedule.'));
}

/** Accept `HH:mm` or `HH:mm:ss` → Postgres `time`. */
export function normalizeLocalTime(value: string): string {
  const trimmed = value.trim();
  if (/^\d{1,2}:\d{2}$/.test(trimmed)) {
    const [h, m] = trimmed.split(':');
    return `${h.padStart(2, '0')}:${m}:00`;
  }
  if (/^\d{1,2}:\d{2}:\d{2}$/.test(trimmed)) {
    const [h, m, s] = trimmed.split(':');
    return `${h.padStart(2, '0')}:${m}:${s}`;
  }
  throw new Error('Use a start time like 08:30.');
}
