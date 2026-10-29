import { newId } from '@/lib/ids';

import { getLocalDb } from './db';
import type { OutboxOperation, OutboxRow } from './types';

function mapOutbox(row: Record<string, unknown>): OutboxRow {
  return {
    id: String(row.id),
    userId: String(row.user_id),
    kitchenId: String(row.kitchen_id),
    mutationId: String(row.mutation_id),
    operation: String(row.operation) as OutboxOperation,
    payloadJson: String(row.payload_json),
    reportedAt: String(row.reported_at),
    createdAt: String(row.created_at),
    attempts: Number(row.attempts),
    lastError: row.last_error == null ? null : String(row.last_error),
    status: String(row.status) as OutboxRow['status'],
  };
}

export async function enqueueOutbox(input: {
  userId: string;
  kitchenId: string;
  mutationId: string;
  operation: OutboxOperation;
  payload: unknown;
  reportedAt: string;
}): Promise<OutboxRow> {
  const db = await getLocalDb();
  const row: OutboxRow = {
    id: newId(),
    userId: input.userId,
    kitchenId: input.kitchenId,
    mutationId: input.mutationId,
    operation: input.operation,
    payloadJson: JSON.stringify(input.payload),
    reportedAt: input.reportedAt,
    createdAt: new Date().toISOString(),
    attempts: 0,
    lastError: null,
    status: 'pending',
  };
  await db.runAsync(
    `INSERT INTO outbox (
      id, user_id, kitchen_id, mutation_id, operation, payload_json,
      reported_at, created_at, attempts, last_error, status
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, NULL, 'pending')`,
    row.id,
    row.userId,
    row.kitchenId,
    row.mutationId,
    row.operation,
    row.payloadJson,
    row.reportedAt,
    row.createdAt,
  );
  return row;
}

export async function listPendingOutbox(
  userId: string,
  kitchenId: string,
): Promise<OutboxRow[]> {
  const db = await getLocalDb();
  const rows = await db.getAllAsync<Record<string, unknown>>(
    `SELECT * FROM outbox
     WHERE user_id = ? AND kitchen_id = ? AND status = 'pending'
     ORDER BY created_at ASC`,
    userId,
    kitchenId,
  );
  return rows.map(mapOutbox);
}

export async function countPendingOutbox(
  userId: string,
  kitchenId?: string | null,
): Promise<number> {
  const db = await getLocalDb();
  if (kitchenId) {
    const row = await db.getFirstAsync<{ c: number }>(
      `SELECT COUNT(*) as c FROM outbox
       WHERE user_id = ? AND kitchen_id = ? AND status = 'pending'`,
      userId,
      kitchenId,
    );
    return row?.c ?? 0;
  }
  const row = await db.getFirstAsync<{ c: number }>(
    `SELECT COUNT(*) as c FROM outbox WHERE user_id = ? AND status = 'pending'`,
    userId,
  );
  return row?.c ?? 0;
}

export async function markOutboxDone(id: string): Promise<void> {
  const db = await getLocalDb();
  await db.runAsync(
    `UPDATE outbox SET status = 'done', last_error = NULL WHERE id = ?`,
    id,
  );
}

export async function markOutboxFailed(
  id: string,
  error: string,
): Promise<void> {
  const db = await getLocalDb();
  await db.runAsync(
    `UPDATE outbox
     SET attempts = attempts + 1, last_error = ?, status = 'pending'
     WHERE id = ?`,
    error.slice(0, 500),
    id,
  );
}

export async function discardPendingOutbox(userId: string): Promise<void> {
  const db = await getLocalDb();
  await db.runAsync(
    `DELETE FROM outbox WHERE user_id = ? AND status = 'pending'`,
    userId,
  );
}

/** Drop a single pending outbox row (e.g. abandon create after local cancel). */
export async function discardOutboxRow(id: string): Promise<void> {
  const db = await getLocalDb();
  await db.runAsync(`DELETE FROM outbox WHERE id = ? AND status = 'pending'`, id);
}
