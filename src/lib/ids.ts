import * as Crypto from 'expo-crypto';

/** Offline-safe UUID for mutations, templates, runs, etc. */
export function newId(): string {
  return Crypto.randomUUID();
}
