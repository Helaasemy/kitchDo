import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { AppState, type AppStateStatus } from 'react-native';

import { useAuth } from '@/features/auth';
import { getDeviceTimeZone, localDateString, nowLocal } from '@/lib/dates';

import {
  buildSyncStatus,
  ensureScheduledOccurrences,
  flushOutbox,
  pullKitchenCache,
} from './engine';
import type { SyncStatus } from './types';

type SyncContextValue = {
  status: SyncStatus;
  refresh: () => Promise<void>;
  retry: () => Promise<void>;
  networkRequired: boolean;
};

const SyncContext = createContext<SyncContextValue | null>(null);

const idleStatus: SyncStatus = {
  kind: 'idle',
  pendingCount: 0,
  lastError: null,
  lastSyncedAt: null,
};

export function SyncProvider({ children }: { children: ReactNode }) {
  const { user, onboarding, status: authStatus } = useAuth();
  const kitchenId = onboarding?.kitchenId ?? null;
  const userId = user?.id ?? null;
  const [status, setStatus] = useState<SyncStatus>(idleStatus);
  const busy = useRef(false);
  const waiters = useRef<Array<() => void>>([]);

  const refresh = useCallback(async () => {
    if (!userId || !kitchenId || authStatus !== 'authenticated') {
      setStatus(idleStatus);
      return;
    }
    if (busy.current) {
      await new Promise<void>((resolve) => {
        waiters.current.push(resolve);
      });
      return;
    }
    busy.current = true;
    setStatus(await buildSyncStatus(userId, kitchenId, { syncing: true }));

    try {
      const zone = getDeviceTimeZone();
      const today = localDateString(nowLocal(zone));
      const from = localDateString(nowLocal(zone).minus({ days: 7 }));
      const to = localDateString(nowLocal(zone).plus({ days: 14 }));

      const ensured = await ensureScheduledOccurrences(
        kitchenId,
        from,
        to,
        zone,
      );
      const flush = await flushOutbox(userId, kitchenId);
      const pull = await pullKitchenCache(userId, kitchenId, {
        fromDate: from,
        toDate: today,
      });

      try {
        const { getRemindersEnabled } = await import('@/features/settings/api');
        const { reconcileReminders } = await import('@/lib/notifications');
        const enabled = await getRemindersEnabled(userId);
        if (enabled && !ensured.offline && !pull.offline) {
          await reconcileReminders({ userId, kitchenId, enabled: true });
        }
      } catch {
        /* reminders are best-effort */
      }

      const offline = ensured.offline || flush.offline || pull.offline;
      const error = flush.error ?? pull.error ?? ensured.error;
      setStatus(
        await buildSyncStatus(userId, kitchenId, {
          offline,
          error: offline ? error : flush.error ?? pull.error,
        }),
      );
    } finally {
      busy.current = false;
      const pending = waiters.current.splice(0);
      pending.forEach((resolve) => resolve());
    }
  }, [userId, kitchenId, authStatus]);

  const retry = useCallback(async () => {
    await refresh();
  }, [refresh]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    const onChange = (next: AppStateStatus) => {
      if (next === 'active') void refresh();
    };
    const sub = AppState.addEventListener('change', onChange);
    return () => sub.remove();
  }, [refresh]);

  const value = useMemo<SyncContextValue>(
    () => ({
      status,
      refresh,
      retry,
      networkRequired: status.kind === 'offline',
    }),
    [status, refresh, retry],
  );

  return <SyncContext.Provider value={value}>{children}</SyncContext.Provider>;
}

export function useSync(): SyncContextValue {
  const ctx = useContext(SyncContext);
  if (!ctx) throw new Error('useSync must be used within SyncProvider');
  return ctx;
}
