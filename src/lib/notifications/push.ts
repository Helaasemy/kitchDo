import Constants from 'expo-constants';
import { AndroidImportance, getExpoPushTokenAsync, setNotificationChannelAsync } from 'expo-notifications';
import { Platform } from 'react-native';

import { getSupabase } from '@/lib/supabase';

import { requestNotificationPermission } from './reminders';

function projectId(): string | undefined {
  return (
    Constants.expoConfig?.extra?.eas?.projectId ??
    Constants.easConfig?.projectId ??
    undefined
  );
}

/** Save this device's Expo push token so assignment alerts can reach a closed app. */
export async function registerPushToken(userId: string): Promise<void> {
  if (Platform.OS === 'web') return;
  try {
    if (Platform.OS === 'android') {
      await setNotificationChannelAsync('default', {
        name: 'default',
        importance: AndroidImportance.DEFAULT,
      });
    }

    const granted = await requestNotificationPermission();
    if (!granted) return;

    const id = projectId();
    if (!id) return;

    const token = (await getExpoPushTokenAsync({ projectId: id })).data;
    if (!token) return;

    await getSupabase().from('kdo_push_tokens').upsert({
      token,
      user_id: userId,
      platform: Platform.OS === 'ios' ? 'ios' : 'android',
      updated_at: new Date().toISOString(),
    });
  } catch {
    /* assignment push is best-effort */
  }
}
