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
  failedCount: 0,
  lastError: null,
  lastSyncedAt: null,
};

function statusEqual(a: SyncStatus, b: SyncStatus): boolean {
  return (
    a.kind === b.kind &&
    a.pendingCount === b.pendingCount &&
    a.failedCount === b.failedCount &&
    a.lastError === b.lastError &&
    a.lastSyncedAt === b.lastSyncedAt
  );
}

export function SyncProvider({ children }: { children: ReactNode }) {
  const { user, onboarding, status: authStatus } = useAuth();
  const kitchenId = onboarding?.kitchenId ?? null;
  const userId = user?.id ?? null;
  const canSync = Boolean(userId && kitchenId && authStatus === 'authenticated');
  const [status, setStatus] = useState<SyncStatus>(idleStatus);
  if (!canSync && status !== idleStatus) setStatus(idleStatus);
  const busy = useRef(false);
  const queued = useRef(false);
  const gen = useRef(0);
  const paramsRef = useRef({ userId, kitchenId, authStatus, gen: 0 });

  useEffect(() => {
    gen.current += 1;
    paramsRef.current = { userId, kitchenId, authStatus, gen: gen.current };
  }, [userId, kitchenId, authStatus]);

  const applyStatus = useCallback((next: SyncStatus) => {
    setStatus((prev) => (statusEqual(prev, next) ? prev : next));
  }, []);

  const refresh = useCallback(async () => {
    const snapshot = paramsRef.current;
    if (!snapshot.userId || !snapshot.kitchenId || snapshot.authStatus !== 'authenticated') {
      return;
    }
    const myGen = snapshot.gen;
    const stillCurrent = () =>
      paramsRef.current.gen === myGen &&
      paramsRef.current.userId === snapshot.userId &&
      paramsRef.current.kitchenId === snapshot.kitchenId;

    if (busy.current) {
      queued.current = true;
      return;
    }

    busy.current = true;
    try {
      do {
        queued.current = false;
        if (!stillCurrent()) return;
        const zone = getDeviceTimeZone();
        const today = localDateString(nowLocal(zone));
        const from = localDateString(nowLocal(zone).minus({ days: 7 }));
        const to = localDateString(nowLocal(zone).plus({ days: 14 }));

        const ensured = await ensureScheduledOccurrences(
          snapshot.kitchenId,
          from,
          to,
          zone,
        );
        if (!stillCurrent()) return;
        const flush = await flushOutbox(snapshot.userId, snapshot.kitchenId);
        if (!stillCurrent()) return;
        const shouldPull = !flush.error && !flush.skipped;
        const pull = shouldPull
          ? await pullKitchenCache(snapshot.userId, snapshot.kitchenId, {
              fromDate: from,
              toDate: today,
            })
          : { offline: false, error: null as string | null };

        try {
          if (shouldPull && stillCurrent()) {
            const { getRemindersEnabled } = await import('@/features/settings/api');
            const { reconcileReminders } = await import('@/lib/notifications');
            const enabled = await getRemindersEnabled(snapshot.userId);
            if (enabled && !ensured.offline && !pull.offline && stillCurrent()) {
              await reconcileReminders({
                userId: snapshot.userId,
                kitchenId: snapshot.kitchenId,
                enabled: true,
              });
            }
          }
        } catch {
          /* reminders are best-effort */
        }

        if (!stillCurrent()) return;
        const offline = ensured.offline || flush.offline || pull.offline;
        const error = flush.error ?? pull.error ?? ensured.error;
        applyStatus(
          await buildSyncStatus(snapshot.userId, snapshot.kitchenId, {
            offline,
            error: offline ? error : flush.error ?? pull.error,
          }),
        );
      } while (queued.current && stillCurrent());
    } catch (e) {
      if (!stillCurrent()) return;
      applyStatus({
        kind: 'error',
        pendingCount: 0,
        failedCount: 0,
        lastError: e instanceof Error ? e.message : 'Sync failed.',
        lastSyncedAt: null,
      });
    } finally {
      busy.current = false;
    }
    // Recreate refresh when the signed-in kitchen changes so the AppState
    // and mount effects start a new cycle. The body reads paramsRef.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId, kitchenId, authStatus, applyStatus]);

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
