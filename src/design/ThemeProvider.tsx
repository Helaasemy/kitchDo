import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import {
  AccessibilityInfo,
  useColorScheme,
} from 'react-native';

import { createTheme, type AppTheme, type ColorScheme } from './theme';

const ThemeContext = createContext<AppTheme | null>(null);

type Props = {
  children: ReactNode;
  /** Force a scheme for previews; defaults to system preference. */
  forceScheme?: ColorScheme;
};

export function ThemeProvider({ children, forceScheme }: Props) {
  const system = useColorScheme();
  const [reduceMotion, setReduceMotion] = useState(false);

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

  const scheme: ColorScheme =
    forceScheme ?? (system === 'dark' ? 'dark' : 'light');

  const theme = useMemo(
    () => createTheme(scheme, reduceMotion),
    [scheme, reduceMotion],
  );

  return (
    <ThemeContext.Provider value={theme}>{children}</ThemeContext.Provider>
  );
}

export function useTheme(): AppTheme {
  const value = useContext(ThemeContext);
  if (!value) {
    throw new Error('useTheme must be used within ThemeProvider');
  }
  return value;
}
