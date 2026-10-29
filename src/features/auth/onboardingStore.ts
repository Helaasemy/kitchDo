import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

import type { KitchenMode } from '@/i18n';

/** SecureStore allows only [A-Za-z0-9._-] — no ":" or "@". */
const prefix = 'kdo_onboarding_v1_';

export type OnboardingDraft = {
  completed: boolean;
  mode: KitchenMode;
  displayName: string;
  kitchenName: string;
  kitchenId?: string;
  kitchenRevision?: number;
};

function storageKey(userId: string): string {
  const safeUser = userId.replace(/[^A-Za-z0-9._-]/g, '_');
  return `${prefix}${safeUser}`;
}

async function readRaw(key: string): Promise<string | null> {
  if (Platform.OS === 'web') {
    try {
      return localStorage.getItem(key);
    } catch {
      return null;
    }
  }
  return SecureStore.getItemAsync(key);
}

async function writeRaw(key: string, value: string | null): Promise<void> {
  if (Platform.OS === 'web') {
    try {
      if (value == null) localStorage.removeItem(key);
      else localStorage.setItem(key, value);
    } catch {
      /* ignore */
    }
    return;
  }
  if (value == null) await SecureStore.deleteItemAsync(key);
  else await SecureStore.setItemAsync(key, value);
}

export async function loadOnboardingState(
  userId: string,
): Promise<OnboardingDraft | null> {
  const raw = await readRaw(storageKey(userId));
  if (!raw) return null;
  try {
    return JSON.parse(raw) as OnboardingDraft;
  } catch {
    return null;
  }
}

export async function saveOnboardingState(
  userId: string,
  draft: OnboardingDraft,
): Promise<void> {
  await writeRaw(storageKey(userId), JSON.stringify(draft));
}

export async function clearOnboardingState(userId: string): Promise<void> {
  await writeRaw(storageKey(userId), null);
}
