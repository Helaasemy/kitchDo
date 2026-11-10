import { Text } from 'react-native';

import { useTheme } from '@/design';

/** Small uppercase label above a group of rows or controls. */
export function SectionLabel({ children }: { children: string }) {
  const theme = useTheme();
  return (
    <Text
      style={{
        fontFamily: theme.fonts.label,
        fontSize: theme.typography.chip.fontSize,
        lineHeight: theme.typography.chip.lineHeight,
        color: theme.colors.inkMuted,
        textTransform: 'uppercase',
        letterSpacing: 0.9,
      }}
      allowFontScaling
    >
      {children}
    </Text>
  );
}
