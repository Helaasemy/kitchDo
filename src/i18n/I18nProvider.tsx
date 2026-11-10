import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import { useLocales } from 'expo-localization';
import * as Updates from 'expo-updates';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { I18nManager, Platform } from 'react-native';

import type { Strings } from './en';
import {
  isLocalePreference,
  isRtlLocale,
  localeDirection,
  resolveLocale,
  stringsFor,
  type AppLocale,
  type LocaleDirection,
  type LocalePreference,
} from './locales';

const STORAGE_KEY = 'kdo.localePreference';

type I18nValue = {
  locale: AppLocale;
  preference: LocalePreference;
  direction: LocaleDirection;
  setPreference: (next: LocalePreference) => Promise<void>;
  strings: Strings;
};

const I18nContext = createContext<I18nValue | null>(null);

let currentStrings: Strings = stringsFor(resolveLocale('system'));

export function t(): Strings {
  return currentStrings;
}

function applyLocale(preference: LocalePreference): AppLocale {
  const locale = resolveLocale(preference);
  currentStrings = stringsFor(locale);
  return locale;
}

export function I18nProvider({ children }: { children: ReactNode }) {
  useLocales();
  const [preference, setPreferenceState] = useState<LocalePreference>('system');
  const [ready, setReady] = useState(false);
  const locale = applyLocale(preference);
  const direction = localeDirection(locale);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const stored = await AsyncStorage.getItem(STORAGE_KEY);
        if (!cancelled && stored && isLocalePreference(stored)) {
          setPreferenceState(stored);
        }
      } finally {
        if (!cancelled) setReady(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!ready || Platform.OS === 'web') return;
    const shouldBeRTL = isRtlLocale(locale);
    if (shouldBeRTL === I18nManager.isRTL) return;
    I18nManager.allowRTL(shouldBeRTL);
    I18nManager.forceRTL(shouldBeRTL);
    // Expo Go resets RTL on reload, which would loop. LocaleProvider still
    // flips navigation; a native rebuild is needed for full layout RTL.
    if (Constants.appOwnership === 'expo') return;
    void Updates.reloadAsync().catch(() => undefined);
  }, [locale, ready]);

  const setPreference = useCallback(async (next: LocalePreference) => {
    setPreferenceState(next);
    await AsyncStorage.setItem(STORAGE_KEY, next);
  }, []);

  const value = useMemo(
    () => ({
      locale,
      preference,
      direction,
      setPreference,
      strings: stringsFor(locale),
    }),
    [direction, locale, preference, setPreference],
  );

  if (!ready) return null;

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n(): I18nValue {
  const value = useContext(I18nContext);
  if (!value) {
    throw new Error('useI18n must be used within I18nProvider');
  }
  return value;
}

/** Subscribe to locale so `t()` results re-render. */
export function useT(): () => Strings {
  useI18n();
  return t;
}
