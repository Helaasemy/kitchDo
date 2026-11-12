import type { ColorScheme } from './theme';

export type AppearancePreference = 'system' | 'light' | 'dark';

export const APPEARANCE_STORAGE_KEY = 'kdo.appearancePreference';

export function isAppearancePreference(
  value: string | null | undefined,
): value is AppearancePreference {
  return value === 'system' || value === 'light' || value === 'dark';
}

export function resolveScheme(
  preference: AppearancePreference,
  system: string | null | undefined,
): ColorScheme {
  if (preference === 'light' || preference === 'dark') return preference;
  return system === 'dark' ? 'dark' : 'light';
}
