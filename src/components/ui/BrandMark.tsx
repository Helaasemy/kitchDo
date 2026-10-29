import { Text, View, type StyleProp, type ViewStyle } from 'react-native';

import { useTheme } from '@/design';
import { t } from '@/i18n';

type Props = {
  size?: 'sm' | 'md' | 'lg';
  style?: StyleProp<ViewStyle>;
};

const sizes = {
  sm: { k: 22, do: 12 },
  md: { k: 36, do: 20 },
  lg: { k: 48, do: 26 },
} as const;

export function BrandMark({ size = 'md', style }: Props) {
  const theme = useTheme();
  const { k: fontSize, do: doSize } = sizes[size];

  return (
    <View
      style={[
        {
          flexDirection: 'row',
          alignItems: 'baseline',
          gap: 1,
        },
        style,
      ]}
      accessibilityRole="header"
      accessibilityLabel={t().brand.product}
    >
      <Text
        style={{
          fontFamily: theme.fonts.display,
          fontSize,
          // Match fontSize so baseline pairing with "do" stays clean.
          lineHeight: fontSize,
          color: theme.colors.primary,
          letterSpacing: -0.5,
          includeFontPadding: false,
        }}
        allowFontScaling
      >
        K
      </Text>
      <Text
        style={{
          fontFamily: theme.fonts.displayRegular,
          fontSize: doSize,
          lineHeight: doSize,
          color: theme.colors.ink,
          letterSpacing: -0.2,
          includeFontPadding: false,
        }}
        allowFontScaling
      >
        do
      </Text>
    </View>
  );
}
