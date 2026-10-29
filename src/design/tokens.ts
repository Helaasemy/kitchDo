export const colors = {
  primary: '#0F766E',
  primaryMuted: '#0D9488',
  canvas: '#F2FBF8',
  ink: '#14302C',
  inkMuted: '#3D5A55',
  inkSubtle: '#6B857F',
  coral: '#E11D48',
  sand: '#FFF8F1',
  border: '#C5DDD7',
  borderStrong: '#9BC4BB',
  white: '#FFFFFF',
  overlay: 'rgba(20, 48, 44, 0.45)',
} as const;

export const colorsDark = {
  primary: '#2DD4BF',
  primaryMuted: '#14B8A6',
  canvas: '#0B1F1C',
  ink: '#E8F5F1',
  inkMuted: '#A8C5BE',
  inkSubtle: '#6B857F',
  coral: '#FB7185',
  sand: '#1A2E2A',
  border: '#1F3D38',
  borderStrong: '#2A524B',
  white: '#14302C',
  overlay: 'rgba(0, 0, 0, 0.55)',
} as const;

export const fonts = {
  display: 'Fraunces_600SemiBold',
  displayRegular: 'Fraunces_500Medium',
  body: 'DMSans_400Regular',
  bodyMedium: 'DMSans_500Medium',
  bodySemiBold: 'DMSans_600SemiBold',
  label: 'IBMPlexMono_500Medium',
  labelRegular: 'IBMPlexMono_400Regular',
} as const;

export const space = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  /** Screen content gutter — 20pt reads more balanced on modern iPhones. */
  screen: 20,
  xl: 24,
  xxl: 32,
  xxxl: 48,
} as const;

export const radii = {
  sm: 12,
  md: 14,
  lg: 16,
  pill: 999,
} as const;

export const motion = {
  fast: 180,
  base: 220,
  slow: 280,
} as const;

export const typography = {
  brand: { fontSize: 36, lineHeight: 42 },
  title: { fontSize: 28, lineHeight: 34 },
  heading: { fontSize: 22, lineHeight: 28 },
  body: { fontSize: 16, lineHeight: 24 },
  bodySmall: { fontSize: 14, lineHeight: 20 },
  label: { fontSize: 12, lineHeight: 16 },
  caption: { fontSize: 13, lineHeight: 18 },
} as const;

export type ColorTokens = typeof colors;
export type FontTokens = typeof fonts;
