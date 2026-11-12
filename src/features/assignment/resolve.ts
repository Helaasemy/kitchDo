export type AssigneeMode = 'inherit' | 'explicit';

export type ItemAssignment = {
  mode: AssigneeMode;
  userId: string | null;
};

export const INHERIT_ASSIGNMENT: ItemAssignment = {
  mode: 'inherit',
  userId: null,
};

export function parseAssigneeMode(value: unknown): AssigneeMode {
  return value === 'explicit' ? 'explicit' : 'inherit';
}

export function normalizeItemAssignment(input: ItemAssignment): ItemAssignment {
  if (input.mode !== 'explicit') {
    return INHERIT_ASSIGNMENT;
  }
  return { mode: 'explicit', userId: input.userId };
}

/** Who actually owns the task after list default + optional override. */
export function effectiveAssignee(
  listUserId: string | null,
  item: ItemAssignment,
): string | null {
  const normalized = normalizeItemAssignment(item);
  if (normalized.mode === 'explicit') return normalized.userId;
  return listUserId;
}

export function isAssignedToMe(
  effectiveUserId: string | null,
  currentUserId: string,
): boolean {
  return effectiveUserId != null && effectiveUserId === currentUserId;
}

export type ItemAssignmentKind = 'anyone' | 'inherit' | 'override';

/** Visual state on a task row in the template editor. */
export function itemAssignmentKind(
  listUserId: string | null,
  item: ItemAssignment,
): ItemAssignmentKind {
  const normalized = normalizeItemAssignment(item);
  if (normalized.mode === 'explicit') {
    return normalized.userId ? 'override' : 'anyone';
  }
  return listUserId ? 'inherit' : 'anyone';
}

export type AssigneePickKind = 'inherit' | 'anyone' | 'member';

export function listAssigneeFromPick(
  kind: AssigneePickKind,
  userId?: string,
): string | null {
  return kind === 'member' ? (userId ?? null) : null;
}

export function itemAssignmentFromPick(
  kind: AssigneePickKind,
  userId?: string,
): ItemAssignment {
  if (kind === 'inherit') return INHERIT_ASSIGNMENT;
  if (kind === 'anyone') return { mode: 'explicit', userId: null };
  return { mode: 'explicit', userId: userId ?? null };
}
