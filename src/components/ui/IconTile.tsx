import type { ComponentProps } from 'react';
import { View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';

import { useTheme } from '@/design';

/** Rounded square (or circle) holding an icon on a tinted background. */
export function IconTile({
  name,
  background,
  color,
  size = 48,
  round = false,
}: {
  name: ComponentProps<typeof Ionicons>['name'];
  background?: string;
  color?: string;
  size?: number;
  round?: boolean;
}) {
  const theme = useTheme();
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: round ? size / 2 : Math.round(size * 0.42),
        backgroundColor: background ?? theme.colors.primaryTint,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <Ionicons name={name} size={Math.round(size * 0.46)} color={color ?? theme.colors.primary} />
    </View>
  );
}
