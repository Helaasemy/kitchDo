import { Text, View, type StyleProp, type ViewStyle } from 'react-native';

import { useTheme } from '@/design';
import { useT } from '@/i18n';

import { Logo } from './Logo';

const typeSizes = {
  sm: 16,
  md: 22,
  lg: 28,
} as const;

export function Wordmark({
  size = 'md',
  style,
}: {
  size?: 'sm' | 'md' | 'lg';
  style?: StyleProp<ViewStyle>;
}) {
  const t = useT();
  const theme = useTheme();
  const fontSize = typeSizes[size];

  return (
    <View
      style={[{ alignItems: 'center', gap: 2 }, style]}
      accessibilityRole="header"
      accessibilityLabel={t().brand.product}
    >
      <Logo size={size} />
      <Text
        style={{
          fontFamily: theme.fonts.bodyExtraBold,
          fontSize,
          lineHeight: fontSize,
          letterSpacing: -0.5,
          color: theme.colors.primary,
        }}
        allowFontScaling
      >
        {t().brand.product}
      </Text>
    </View>
  );
}
