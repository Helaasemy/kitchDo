import { Pressable, Text } from 'react-native';

import { useTheme } from '@/design';

type Props = {
  label: string;
  selected?: boolean;
  onPress: () => void;
  onLongPress?: () => void;
};

/** Compact filter chip — fixed min height, centered label, 8pt+ gaps via parent. */
export function Chip({ label, selected = false, onPress, onLongPress }: Props) {
  const theme = useTheme();

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected }}
      onPress={onPress}
      onLongPress={onLongPress}
      style={{
        height: 32,
        paddingHorizontal: 12,
        marginRight: 8,
        marginBottom: 8,
        borderRadius: theme.radii.pill,
        borderWidth: 1,
        borderColor: selected ? theme.colors.primary : theme.colors.border,
        backgroundColor: selected ? theme.colors.primary : theme.colors.white,
        alignItems: 'center',
        justifyContent: 'center',
        alignSelf: 'flex-start',
        flexGrow: 0,
        flexShrink: 0,
        flexBasis: 'auto',
      }}
    >
      <Text
        style={{
          fontFamily: theme.fonts.bodyMedium,
          fontSize: theme.typography.bodySmall.fontSize,
          lineHeight: theme.typography.bodySmall.lineHeight,
          color: selected ? theme.colors.white : theme.colors.ink,
          textAlign: 'center',
          includeFontPadding: false,
        }}
        allowFontScaling
      >
        {label}
      </Text>
    </Pressable>
  );
}
