import { type ImageStyle, type StyleProp } from 'react-native';

import { Logo } from './Logo';

type Props = {
  size?: 'sm' | 'md' | 'lg';
  style?: StyleProp<ImageStyle>;
};

export function BrandMark({ size = 'md', style }: Props) {
  return <Logo size={size} style={style} />;
}
