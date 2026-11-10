import type { ReactNode } from 'react';
import { View, type StyleProp, type ViewStyle } from 'react-native';

import { useTheme } from '@/design';

/** Paper surface: hairline border, soft shadow. Children own their padding and dividers. */
export function PaperCard({
  children,
  style,
}: {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  const theme = useTheme();
  return (
    <View
      style={[
        {
          backgroundColor: theme.colors.card,
          borderRadius: theme.radii.xl,
          borderWidth: 0.5,
          borderColor: theme.colors.border,
          boxShadow: theme.shadows.soft,
          overflow: 'hidden',
        },
        style,
      ]}
    >
      {children}
    </View>
  );
}
