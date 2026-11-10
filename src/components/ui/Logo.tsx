import { Image, type ImageStyle, type StyleProp } from 'react-native';

import { useT } from '@/i18n';

type Size = 'sm' | 'md' | 'lg';

const sources = {
  sm: require('../../../assets/logo-sm.png'),
  md: require('../../../assets/logo.png'),
  lg: require('../../../assets/logo.png'),
} as const;

const sizes = {
  sm: 32,
  md: 56,
  lg: 72,
} as const;

export function Logo({
  size = 'md',
  style,
}: {
  size?: Size;
  style?: StyleProp<ImageStyle>;
}) {
  const t = useT();
  const dim = sizes[size];
  return (
    <Image
      source={sources[size]}
      style={[{ width: dim, height: dim }, style]}
      accessibilityRole="image"
      accessibilityLabel={t().brand.product}
    />
  );
}
