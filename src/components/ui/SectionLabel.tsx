import { Text } from 'react-native';

import { useTheme } from '@/design';

/** Small uppercase label above a group of rows or controls. */
export function SectionLabel({ children }: { children: string }) {
  const theme = useTheme();
  return (
    <Text
      style={{
        fontFamily: theme.fonts.label,
        fontSize: theme.typography.label.fontSize,
        lineHeight: theme.typography.label.lineHeight,
        color: theme.colors.inkSubtle,
        textTransform: 'uppercase',
        letterSpacing: 0.6,
      }}
      allowFontScaling
    >
      {children}
    </Text>
  );
}
