import AsyncStorage from '@react-native-async-storage/async-storage';

import {
  cancelAllMappedReminders,
  reconcileReminders,
  requestNotificationPermission,
} from '@/lib/notifications';
import { countPendingOutbox, discardPendingOutbox } from '@/lib/storage';
import { getSupabase, rpcErrorMessage } from '@/lib/supabase';

const REMINDERS_KEY = 'kdo_reminders_enabled_v1:';

export async function getRemindersEnabled(userId: string): Promise<boolean> {
  const raw = await AsyncStorage.getItem(REMINDERS_KEY + userId);
  return raw === '1';
}

export async function setRemindersEnabled(input: {
  userId: string;
  kitchenId: string;
  enabled: boolean;
}): Promise<{ enabled: boolean; permissionDenied: boolean }> {
  if (input.enabled) {
    const granted = await requestNotificationPermission();
    if (!granted) {
      await AsyncStorage.setItem(REMINDERS_KEY + input.userId, '0');
      return { enabled: false, permissionDenied: true };
    }
    await AsyncStorage.setItem(REMINDERS_KEY + input.userId, '1');
    await reconcileReminders({
      userId: input.userId,
      kitchenId: input.kitchenId,
      enabled: true,
    });
    return { enabled: true, permissionDenied: false };
  }

  await AsyncStorage.setItem(REMINDERS_KEY + input.userId, '0');
  await cancelAllMappedReminders(input.userId, input.kitchenId);
  return { enabled: false, permissionDenied: false };
}

export async function deleteMyAccount(): Promise<void> {
  const { error } = await getSupabase().rpc('delete_my_account');
  if (error) throw new Error(rpcErrorMessage(error));
}

export async function pendingMutationCount(userId: string): Promise<number> {
  return countPendingOutbox(userId);
}

export async function discardPendingMutations(userId: string): Promise<void> {
  await discardPendingOutbox(userId);
}
