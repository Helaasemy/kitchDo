import { getLocales } from 'expo-localization';

import { ar } from './ar';
import { de } from './de';
import { en, type Strings } from './en';
import { es } from './es';
import { fr } from './fr';
import { id } from './id';
import { it } from './it';
import { ja } from './ja';
import { ko } from './ko';
import { pt } from './pt';
import { tr } from './tr';
import { zh } from './zh';

export const APP_LOCALES = [
  'en',
  'fr',
  'es',
  'pt',
  'de',
  'it',
  'id',
  'tr',
  'zh',
  'ja',
  'ko',
  'ar',
] as const;

export type AppLocale = (typeof APP_LOCALES)[number];

export type LocalePreference = 'system' | AppLocale;

export type LocaleDirection = 'ltr' | 'rtl';

export const LOCALE_LABELS: Record<AppLocale, string> = {
  en: 'English',
  fr: 'Français',
  es: 'Español',
  pt: 'Português',
  de: 'Deutsch',
  it: 'Italiano',
  id: 'Indonesia',
  tr: 'Türkçe',
  zh: '中文',
  ja: '日本語',
  ko: '한국어',
  ar: 'العربية',
};

const catalogs: Record<AppLocale, Strings> = {
  en,
  fr,
  es,
  pt,
  de,
  it,
  id,
  tr,
  zh,
  ja,
  ko,
  ar,
};

/** Android still reports Indonesian as `in`. */
const LANGUAGE_ALIASES: Record<string, AppLocale> = {
  in: 'id',
};

export const DEFAULT_LOCALE: AppLocale = 'en';

export function isAppLocale(value: string): value is AppLocale {
  return (APP_LOCALES as readonly string[]).includes(value);
}

export function isLocalePreference(value: string): value is LocalePreference {
  return value === 'system' || isAppLocale(value);
}

export function isRtlLocale(locale: AppLocale): boolean {
  return locale === 'ar';
}

export function localeDirection(locale: AppLocale): LocaleDirection {
  return isRtlLocale(locale) ? 'rtl' : 'ltr';
}

export function deviceLanguageCode(): string {
  return getLocales()[0]?.languageCode?.toLowerCase() ?? DEFAULT_LOCALE;
}

function matchAppLocale(code: string | null | undefined): AppLocale | null {
  if (!code) return null;
  const normalized = LANGUAGE_ALIASES[code.toLowerCase()] ?? code.toLowerCase();
  return isAppLocale(normalized) ? normalized : null;
}

export function resolveLocale(preference: LocalePreference): AppLocale {
  if (preference !== 'system') return preference;
  for (const loc of getLocales()) {
    const matched = matchAppLocale(loc.languageCode);
    if (matched) return matched;
  }
  return DEFAULT_LOCALE;
}

export function stringsFor(locale: AppLocale): Strings {
  return catalogs[locale];
}
