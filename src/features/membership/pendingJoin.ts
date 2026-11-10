import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

import { parseJoinPayload } from './joinCode';

const KEY = 'kdo_pending_join_code_v1';

export type PendingJoin = {
  code: string;
  displayName?: string;
};

async function readRaw(): Promise<string | null> {
  if (Platform.OS === 'web') {
    try {
      return localStorage.getItem(KEY);
    } catch {
      return null;
    }
  }
  return SecureStore.getItemAsync(KEY);
}

async function writeRaw(value: string | null): Promise<void> {
  if (Platform.OS === 'web') {
    try {
      if (value == null) localStorage.removeItem(KEY);
      else localStorage.setItem(KEY, value);
    } catch {
      /* ignore */
    }
    return;
  }
  if (value == null) await SecureStore.deleteItemAsync(KEY);
  else await SecureStore.setItemAsync(KEY, value);
}

function parseStored(raw: string | null): PendingJoin | null {
  if (!raw) return null;
  if (raw.startsWith('{')) {
    try {
      const parsed = JSON.parse(raw) as { code?: string; displayName?: string };
      const code = parseJoinPayload(parsed.code);
      if (!code) return null;
      const displayName = parsed.displayName?.trim();
      return displayName ? { code, displayName } : { code };
    } catch {
      /* fall through to a raw code */
    }
  }
  const code = parseJoinPayload(raw);
  return code ? { code } : null;
}

export async function loadPendingJoin(): Promise<PendingJoin | null> {
  return parseStored(await readRaw());
}

export async function stashPendingJoinCode(
  raw: string,
  displayName?: string,
): Promise<string | null> {
  const code = parseJoinPayload(raw);
  if (!code) return null;
  const prev = parseStored(await readRaw());
  const next: PendingJoin = {
    code,
    displayName: displayName?.trim() || prev?.displayName,
  };
  await writeRaw(JSON.stringify(next));
  return code;
}

export async function loadPendingJoinCode(): Promise<string | null> {
  const pending = await loadPendingJoin();
  return pending?.code ?? null;
}

export async function clearPendingJoinCode(): Promise<void> {
  await writeRaw(null);
}

export function isJoinUrl(url: string): boolean {
  return /kitchdo:\/\/join/i.test(url) || /\/join\//i.test(url) || /\/join\b/i.test(url);
}
