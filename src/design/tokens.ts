import type { TaskFrequency } from '@/features/recurring/period';

export type FrequencyColors = {
  /** Fills: checkbox, dot. */
  base: string;
  /** Chip and tile background. */
  tint: string;
  /** Text on `tint` or the canvas; meets AA at small sizes. */
  text: string;
};

export const colors = {
  primary: '#C4452A',
  primaryMuted: '#A93A22',
  canvas: '#FBF6EE',
  ink: '#2B211C',
  inkMuted: '#7A6A5F',
  inkSubtle: '#7D6C61',
  coral: '#C43E2A',
  sand: '#F7EEE3',
  border: '#EADFD2',
  borderStrong: '#D9C9B8',
  white: '#FFFFFF',
  onPrimary: '#FFFFFF',
  onCoral: '#FFFFFF',
  card: '#FFFDF9',
  alertTint: '#FFF5F5',
  primaryTint: '#FBE5DE',
  overlay: 'rgba(43, 33, 28, 0.45)',
  frequency: {
    daily: { base: '#F4A261', tint: '#FFF1E8', text: '#A65A1E' },
    weekly: { base: '#9C8FD9', tint: '#EFEBFA', text: '#6253B8' },
    monthly: { base: '#7FB08A', tint: '#E6F1E8', text: '#3A7149' },
    once: { base: '#C4B5A5', tint: '#F4EEE8', text: '#6F6258' },
  } satisfies Record<TaskFrequency, FrequencyColors>,
} as const;

export const colorsDark = {
  primary: '#F07A55',
  primaryMuted: '#E0623C',
  canvas: '#1A1512',
  ink: '#F5EDE4',
  inkMuted: '#C2B2A5',
  inkSubtle: '#A08F82',
  coral: '#FF7A66',
  sand: '#2A221D',
  border: '#3A302A',
  borderStrong: '#4A3E36',
  white: '#231C18',
  onPrimary: '#1A1512',
  onCoral: '#1A1512',
  card: '#211A16',
  alertTint: '#3A2220',
  primaryTint: '#3D251C',
  overlay: 'rgba(0, 0, 0, 0.55)',
  frequency: {
    daily: { base: '#F4A261', tint: '#3A2A1E', text: '#F7BC8A' },
    weekly: { base: '#A99BFF', tint: '#2B2740', text: '#C3B9FF' },
    monthly: { base: '#8CC7A1', tint: '#22312A', text: '#A6D8B6' },
    once: { base: '#C4B5A5', tint: '#3A322C', text: '#D4C6B8' },
  } satisfies Record<TaskFrequency, FrequencyColors>,
} as const;

export const fonts = {
  display: 'InstrumentSerif_400Regular_Italic',
  displayRegular: 'InstrumentSerif_400Regular',
  body: 'PlusJakartaSans_400Regular',
  bodyMedium: 'PlusJakartaSans_500Medium',
  bodySemiBold: 'PlusJakartaSans_600SemiBold',
  bodyBold: 'PlusJakartaSans_700Bold',
  bodyExtraBold: 'PlusJakartaSans_800ExtraBold',
  label: 'PlusJakartaSans_800ExtraBold',
  labelRegular: 'PlusJakartaSans_600SemiBold',
} as const;

export const space = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  /** Screen content gutter. */
  screen: 24,
  xl: 24,
  xxl: 32,
  xxxl: 48,
} as const;

export const radii = {
  sm: 12,
  md: 14,
  lg: 16,
  xl: 20,
  xxl: 28,
  pill: 999,
} as const;

export const motion = {
  fast: 180,
  base: 220,
  slow: 280,
} as const;

export const typography = {
  display: { fontSize: 42, lineHeight: 46 },
  brand: { fontSize: 36, lineHeight: 42 },
  title: { fontSize: 32, lineHeight: 36 },
  heading: { fontSize: 22, lineHeight: 28 },
  cardTitle: { fontSize: 18, lineHeight: 24 },
  body: { fontSize: 16, lineHeight: 24 },
  bodySmall: { fontSize: 14, lineHeight: 20 },
  label: { fontSize: 12, lineHeight: 16 },
  caption: { fontSize: 13, lineHeight: 18 },
  chip: { fontSize: 11, lineHeight: 14 },
} as const;

export type ColorTokens = typeof colors;
export type FontTokens = typeof fonts;
