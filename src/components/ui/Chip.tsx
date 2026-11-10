import { Pressable, Text, type PressableProps } from 'react-native';

import { useTheme } from '@/design';

type Props = {
  label: string;
  selected?: boolean;
  onPress: () => void;
  onLongPress?: () => void;
  accessibilityHint?: string;
  accessibilityActions?: PressableProps['accessibilityActions'];
  onAccessibilityAction?: PressableProps['onAccessibilityAction'];
};

/** Pill filter chip: 36pt visual, 44pt touch target via hitSlop; the parent owns the gaps. */
export function Chip({
  label,
  selected = false,
  onPress,
  onLongPress,
  accessibilityHint,
  accessibilityActions,
  onAccessibilityAction,
}: Props) {
  const theme = useTheme();

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected }}
      accessibilityHint={accessibilityHint}
      accessibilityActions={accessibilityActions}
      onAccessibilityAction={onAccessibilityAction}
      onPress={onPress}
      onLongPress={onLongPress}
      hitSlop={4}
      style={({ pressed }) => ({
        minHeight: 44,
        paddingHorizontal: 16,
        paddingVertical: 4,
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
          color: selected ? theme.colors.onPrimary : theme.colors.inkMuted,
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
