import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';

import { useT } from '@/i18n';

import {
  listRecurringTasks,
  setTaskBlocked,
  setTaskDone,
  type RecurringTaskState,
} from './api';
import { hydrateRecurringTasks } from './hydrate';

/** Keep a just-closed task in its list spot this long before it drops to the bottom. */
export const SETTLE_CLOSED_MS = 60_000;

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
  const [parkedIds, setParkedIds] = useState<ReadonlySet<string>>(() => new Set());
  const parkTimers = useRef(new Map<string, ReturnType<typeof setTimeout>>());

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

  const unpark = useCallback((itemId: string) => {
    const timer = parkTimers.current.get(itemId);
    if (timer) clearTimeout(timer);
    parkTimers.current.delete(itemId);
    setParkedIds((prev) => {
      if (!prev.has(itemId)) return prev;
      const next = new Set(prev);
      next.delete(itemId);
      return next;
    });
  }, []);

  const park = useCallback(
    (itemId: string) => {
      const existing = parkTimers.current.get(itemId);
      if (existing) clearTimeout(existing);
      setParkedIds((prev) => {
        if (prev.has(itemId)) return prev;
        const next = new Set(prev);
        next.add(itemId);
        return next;
      });
      parkTimers.current.set(
        itemId,
        setTimeout(() => {
          parkTimers.current.delete(itemId);
          setParkedIds((prev) => {
            if (!prev.has(itemId)) return prev;
            const next = new Set(prev);
            next.delete(itemId);
            return next;
          });
        }, SETTLE_CLOSED_MS),
      );
    },
    [],
  );

  const toggle = useCallback(
    async (task: RecurringTaskState) => {
      if (!userId || !kitchenId) return;
      const done = !task.done;
      if (done) park(task.itemId);
      else unpark(task.itemId);
      setError(null);
      setTasks((prev) =>
        prev.map((row) =>
          row.itemId === task.itemId
            ? { ...row, done, outcome: done ? 'done' : null, note: null }
            : row,
        ),
      );
      try {
        await setTaskDone({ userId, kitchenId, task, done });
      } catch {
        setError(t().recurring.toggleFailed);
        await reload();
      }
    },
    [userId, kitchenId, park, unpark, reload, t],
  );

  const block = useCallback(
    async (task: RecurringTaskState, note: string) => {
      if (!userId || !kitchenId) return;
      const trimmed = note.trim();
      if (!trimmed) return;
      park(task.itemId);
      setError(null);
      setTasks((prev) =>
        prev.map((row) =>
          row.itemId === task.itemId
            ? { ...row, done: true, outcome: 'blocked', note: trimmed }
            : row,
        ),
      );
      try {
        await setTaskBlocked({ userId, kitchenId, task, note: trimmed });
      } catch {
        setError(t().recurring.toggleFailed);
        await reload();
      }
    },
    [userId, kitchenId, park, reload, t],
  );

  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') void reload();
    });
    return () => sub.remove();
  }, [reload]);

  useEffect(
    () => () => {
      for (const timer of parkTimers.current.values()) clearTimeout(timer);
      parkTimers.current.clear();
    },
    [],
  );

  return { tasks, reload, toggle, block, error, parkedIds };
}
