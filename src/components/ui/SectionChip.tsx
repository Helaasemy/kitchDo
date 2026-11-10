import type { ReactNode } from 'react';
import { Text, View } from 'react-native';

import { useTheme } from '@/design';

export type ChipTone = { background: string; text: string; dot?: string };

/** Uppercase pill heading for a section, with an optional trailing hint or action. */
export function SectionChip({
  label,
  chipTone,
  hint,
  right,
}: {
  label: string;
  /** Defaults to the neutral sand chip. */
  chipTone?: ChipTone;
  hint?: string;
  right?: ReactNode;
}) {
  const theme = useTheme();
  const tone = chipTone ?? { background: theme.colors.sand, text: theme.colors.ink };

  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: theme.space.sm,
      }}
    >
      <View
        accessibilityRole="header"
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: theme.space.sm,
          paddingHorizontal: 14,
          paddingVertical: 6,
          borderRadius: theme.radii.pill,
          backgroundColor: tone.background,
          flexShrink: 1,
        }}
      >
        {tone.dot ? (
          <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: tone.dot }} />
        ) : null}
        <Text
          style={{
            fontFamily: theme.fonts.label,
            fontSize: theme.typography.chip.fontSize,
            lineHeight: theme.typography.chip.lineHeight,
            letterSpacing: 0.66,
            textTransform: 'uppercase',
            color: tone.text,
          }}
          numberOfLines={1}
          allowFontScaling
        >
          {label}
        </Text>
      </View>
      {hint ? (
        <Text
          style={{
            fontFamily: theme.fonts.bodyExtraBold,
            fontSize: theme.typography.label.fontSize,
            color: theme.colors.inkMuted,
          }}
          allowFontScaling
        >
          {hint}
        </Text>
      ) : null}
      {right}
    </View>
  );
}
