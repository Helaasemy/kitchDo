import { useCallback, useState } from 'react';

import {
  listRecurringTasks,
  setTaskDone,
  type RecurringTaskState,
} from './api';

/**
 * Recurring tasks plus an optimistic toggle. `templateId` limits the list to
 * one template; omit it for every template (Today).
 */
export function useRecurringTasks(
  userId: string | undefined,
  kitchenId: string | null | undefined,
  templateId?: string,
) {
  const [tasks, setTasks] = useState<RecurringTaskState[]>([]);

  const reload = useCallback(async () => {
    if (!userId || !kitchenId) {
      setTasks([]);
      return;
    }
    setTasks(await listRecurringTasks(userId, kitchenId, templateId));
  }, [userId, kitchenId, templateId]);

  const toggle = useCallback(
    async (task: RecurringTaskState) => {
      if (!userId || !kitchenId) return;
      const done = !task.done;
      setTasks((prev) =>
        prev.map((t) => (t.itemId === task.itemId ? { ...t, done } : t)),
      );
      try {
        await setTaskDone({ userId, kitchenId, task, done });
      } catch {
        await reload();
      }
    },
    [userId, kitchenId, reload],
  );

  return { tasks, reload, toggle };
}
