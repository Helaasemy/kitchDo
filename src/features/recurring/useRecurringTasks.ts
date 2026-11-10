import { useCallback, useEffect, useState } from 'react';
import { AppState } from 'react-native';

import { useT } from '@/i18n';

import {
  listRecurringTasks,
  setTaskDone,
  type RecurringTaskState,
} from './api';
import { hydrateRecurringTasks } from './hydrate';

/**
 * Recurring tasks plus an optimistic toggle. `templateId` limits the list to
 * one template; omit it for every template (Today).
 */
export function useRecurringTasks(
  userId: string | undefined,
  kitchenId: string | null | undefined,
  templateId?: string,
) {
  const t = useT();
  const [tasks, setTasks] = useState<RecurringTaskState[]>([]);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    if (!userId || !kitchenId) {
      setTasks([]);
      return;
    }
    try {
      setError(null);
      await hydrateRecurringTasks(userId, kitchenId);
      setTasks(await listRecurringTasks(userId, kitchenId, templateId));
    } catch {
      setError(t().recurring.loadFailed);
    }
  }, [userId, kitchenId, templateId, t]);

  const toggle = useCallback(
    async (task: RecurringTaskState) => {
      if (!userId || !kitchenId) return;
      const done = !task.done;
      setError(null);
      setTasks((prev) =>
        prev.map((row) => (row.itemId === task.itemId ? { ...row, done } : row)),
      );
      try {
        await setTaskDone({ userId, kitchenId, task, done });
      } catch {
        setError(t().recurring.toggleFailed);
        await reload();
      }
    },
    [userId, kitchenId, reload, t],
  );

  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') void reload();
    });
    return () => sub.remove();
  }, [reload]);

  return { tasks, reload, toggle, error };
}
