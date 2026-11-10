import type { TaskFrequency } from '@/features/recurring/period';

import {
  colors,
  colorsDark,
  fonts,
  motion,
  radii,
  space,
  typography,
  type FrequencyColors,
} from './tokens';

export type ColorScheme = 'light' | 'dark';

export type ThemeColors = {
  primary: string;
  primaryMuted: string;
  canvas: string;
  ink: string;
  inkMuted: string;
  inkSubtle: string;
  coral: string;
  sand: string;
  border: string;
  borderStrong: string;
  white: string;
  card: string;
  alertTint: string;
  primaryTint: string;
  overlay: string;
  frequency: Record<TaskFrequency, FrequencyColors>;
};

export type AppTheme = {
  scheme: ColorScheme;
  colors: ThemeColors;
  fonts: typeof fonts;
  space: typeof space;
  radii: typeof radii;
  motion: { fast: number; base: number; slow: number };
  typography: typeof typography;
  /** CSS `boxShadow` strings: `soft` for paper cards, `raised` for floating cards. */
  shadows: { soft: string; raised: string };
  reduceMotion: boolean;
};

export function createTheme(
  scheme: ColorScheme,
  reduceMotion = false,
): AppTheme {
  const dark = scheme === 'dark';
  return {
    scheme,
    colors: dark ? colorsDark : colors,
    fonts,
    space,
    radii,
    motion: reduceMotion ? { fast: 0, base: 0, slow: 0 } : { ...motion },
    typography,
    shadows: dark
      ? { soft: '0 4px 16px rgba(0, 0, 0, 0.25)', raised: '0 4px 16px rgba(0, 0, 0, 0.4)' }
      : {
          soft: '0 4px 16px rgba(43, 33, 28, 0.03)',
          raised: '0 4px 16px rgba(43, 33, 28, 0.08)',
        },
    reduceMotion,
  };
}
