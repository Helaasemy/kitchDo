import type { ComponentProps } from 'react';
import { Pressable } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';

import { useTheme } from '@/design';

type Props = {
  name: ComponentProps<typeof Ionicons>['name'];
  accessibilityLabel: string;
  onPress: () => void;
  size?: number;
};

/** 44×44 round touch target with centered icon — for header trailing actions. */
export function IconButton({
  name,
  accessibilityLabel,
  onPress,
  size = 22,
}: Props) {
  const theme = useTheme();

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      onPress={onPress}
      hitSlop={4}
      style={({ pressed }) => ({
        width: 44,
        height: 44,
        borderRadius: theme.radii.pill,
        backgroundColor: theme.colors.white,
        borderWidth: 0.5,
        borderColor: theme.colors.border,
        boxShadow: theme.shadows.soft,
        alignItems: 'center',
        justifyContent: 'center',
        opacity: pressed ? 0.85 : 1,
      })}
    >
      <Ionicons name={name} size={size} color={theme.colors.ink} />
    </Pressable>
  );
}
