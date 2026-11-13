import { getSupabase } from '@/lib/supabase';

import { newlyAssignedUserIds, type ItemAssignment } from './resolve';

/** Best-effort closed-phone ping. Failures must not block saving the assignment. */
export async function notifyNewAssignees(input: {
  actorUserId: string;
  kitchenId: string;
  templateId: string;
  templateTitle: string;
  previous: { listUserId: string | null; items: ItemAssignment[] };
  next: { listUserId: string | null; items: ItemAssignment[] };
}): Promise<void> {
  const assigneeUserIds = newlyAssignedUserIds(
    input.previous,
    input.next,
    input.actorUserId,
  );
  if (assigneeUserIds.length === 0) return;
  try {
    const { error } = await getSupabase().functions.invoke('notify-assignment', {
      body: {
        kitchenId: input.kitchenId,
        templateId: input.templateId,
        templateTitle: input.templateTitle,
        assigneeUserIds,
      },
    });
    if (error && __DEV__) {
      console.warn('[KitchDo] assignment push', error.message);
    }
  } catch {
    /* assignment is already saved */
  }
}
