import {
  colors,
  colorsDark,
  fonts,
  motion,
  radii,
  space,
  typography,
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
  overlay: string;
};

export type AppTheme = {
  scheme: ColorScheme;
  colors: ThemeColors;
  fonts: typeof fonts;
  space: typeof space;
  radii: typeof radii;
  motion: { fast: number; base: number; slow: number };
  typography: typeof typography;
  reduceMotion: boolean;
};

export function createTheme(
  scheme: ColorScheme,
  reduceMotion = false,
): AppTheme {
  return {
    scheme,
    colors: scheme === 'dark' ? colorsDark : colors,
    fonts,
    space,
    radii,
    motion: reduceMotion ? { fast: 0, base: 0, slow: 0 } : { ...motion },
    typography,
    reduceMotion,
  };
}
