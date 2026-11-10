import { Pressable, Text } from 'react-native';

import { useTheme } from '@/design';

type Props = {
  label: string;
  selected?: boolean;
  onPress: () => void;
  onLongPress?: () => void;
};

/** Pill filter chip — fixed min height, centered label, 8pt+ gaps via parent. */
export function Chip({ label, selected = false, onPress, onLongPress }: Props) {
  const theme = useTheme();

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected }}
      onPress={onPress}
      onLongPress={onLongPress}
      hitSlop={{ top: 4, bottom: 4 }}
      style={({ pressed }) => ({
        height: 36,
        paddingHorizontal: 16,
        marginRight: 8,
        marginBottom: 8,
        borderRadius: theme.radii.pill,
        borderWidth: selected ? 0 : 0.5,
        borderColor: theme.colors.border,
        backgroundColor: selected ? theme.colors.primary : theme.colors.white,
        boxShadow: selected ? undefined : theme.shadows.soft,
        opacity: pressed ? 0.85 : 1,
        alignItems: 'center',
        justifyContent: 'center',
        alignSelf: 'flex-start',
        flexGrow: 0,
        flexShrink: 0,
        flexBasis: 'auto',
      })}
    >
      <Text
        style={{
          fontFamily: theme.fonts.label,
          fontSize: theme.typography.label.fontSize,
          lineHeight: theme.typography.label.lineHeight,
          letterSpacing: 0.6,
          textTransform: 'uppercase',
          color: selected ? '#FFFFFF' : theme.colors.inkMuted,
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
