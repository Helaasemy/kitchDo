import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import {
  AccessibilityInfo,
  Appearance,
  useColorScheme,
} from 'react-native';

import {
  APPEARANCE_STORAGE_KEY,
  isAppearancePreference,
  resolveScheme,
  type AppearancePreference,
} from './appearance';
import { createTheme, type AppTheme, type ColorScheme } from './theme';

type ThemeContextValue = {
  theme: AppTheme;
  preference: AppearancePreference;
  setPreference: (next: AppearancePreference) => Promise<void>;
};

const ThemeContext = createContext<ThemeContextValue | null>(null);

type Props = {
  children: ReactNode;
  /** Force a scheme for previews; defaults to the stored / system preference. */
  forceScheme?: ColorScheme;
};

function applyNativeScheme(preference: AppearancePreference) {
  Appearance.setColorScheme(preference === 'system' ? 'auto' : preference);
}

export function ThemeProvider({ children, forceScheme }: Props) {
  const system = useColorScheme();
  const [reduceMotion, setReduceMotion] = useState(false);
  const [preference, setPreferenceState] = useState<AppearancePreference>('system');
  const [ready, setReady] = useState(forceScheme != null);

  useEffect(() => {
    let mounted = true;
    AccessibilityInfo.isReduceMotionEnabled().then((enabled) => {
      if (mounted) setReduceMotion(enabled);
    });
    const sub = AccessibilityInfo.addEventListener(
      'reduceMotionChanged',
      setReduceMotion,
    );
    return () => {
      mounted = false;
      sub.remove();
    };
  }, []);

  useEffect(() => {
    if (forceScheme) return;
    let cancelled = false;
    void (async () => {
      try {
        const stored = await AsyncStorage.getItem(APPEARANCE_STORAGE_KEY);
        if (!cancelled && isAppearancePreference(stored)) {
          setPreferenceState(stored);
          applyNativeScheme(stored);
        }
      } finally {
        if (!cancelled) setReady(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [forceScheme]);

  const setPreference = useCallback(async (next: AppearancePreference) => {
    setPreferenceState(next);
    applyNativeScheme(next);
    await AsyncStorage.setItem(APPEARANCE_STORAGE_KEY, next);
  }, []);

  const scheme: ColorScheme =
    forceScheme ?? resolveScheme(preference, system);

  const theme = useMemo(
    () => createTheme(scheme, reduceMotion),
    [scheme, reduceMotion],
  );

  const value = useMemo(
    () => ({ theme, preference, setPreference }),
    [theme, preference, setPreference],
  );

  if (!ready) return null;

  return (
    <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
  );
}

export function useTheme(): AppTheme {
  const value = useContext(ThemeContext);
  if (!value) {
    throw new Error('useTheme must be used within ThemeProvider');
  }
  return value.theme;
}

export function useAppearance() {
  const value = useContext(ThemeContext);
  if (!value) {
    throw new Error('useAppearance must be used within ThemeProvider');
  }
  return {
    preference: value.preference,
    setPreference: value.setPreference,
  };
}
