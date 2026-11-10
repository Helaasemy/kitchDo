export type SyncStatusKind =
  | 'idle'
  | 'offline'
  | 'syncing'
  | 'changes_waiting'
  | 'error';

export type SyncStatus = {
  kind: SyncStatusKind;
  pendingCount: number;
  failedCount: number;
  lastError: string | null;
  lastSyncedAt: string | null;
};
