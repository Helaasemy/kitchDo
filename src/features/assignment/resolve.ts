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

type AssignmentSnapshot = {
  listUserId: string | null;
  items: ItemAssignment[];
};

function assignedUserIds(snapshot: AssignmentSnapshot): Set<string> {
  const ids = new Set<string>();
  if (snapshot.listUserId) ids.add(snapshot.listUserId);
  for (const item of snapshot.items) {
    const userId = effectiveAssignee(snapshot.listUserId, item);
    if (userId) ids.add(userId);
  }
  return ids;
}

/** People who gained a list or task, excluding Anyone and the person making the change. */
export function newlyAssignedUserIds(
  previous: AssignmentSnapshot,
  next: AssignmentSnapshot,
  actorUserId: string,
): string[] {
  const before = assignedUserIds(previous);
  const after = assignedUserIds(next);
  return [...after].filter((id) => !before.has(id) && id !== actorUserId);
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
