import { useRef } from 'react';
import {
  ActivityIndicator,
  Animated,
  Pressable,
  Text,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import * as Haptics from 'expo-haptics';

import { useTheme } from '@/design';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger';

type Props = {
  label: string;
  onPress: () => void;
  variant?: Variant;
  disabled?: boolean;
  loading?: boolean;
  style?: StyleProp<ViewStyle>;
  compact?: boolean;
};

export function Button({
  label,
  onPress,
  variant = 'primary',
  disabled = false,
  loading = false,
  style,
  compact = false,
}: Props) {
  const theme = useTheme();
  const scale = useRef(new Animated.Value(1)).current;
  const busy = disabled || loading;

  const palette = {
    primary: {
      bg: theme.colors.primary,
      fg: theme.colors.white,
      border: theme.colors.primary,
    },
    secondary: {
      bg: theme.colors.sand,
      fg: theme.colors.ink,
      border: theme.colors.border,
    },
    ghost: {
      bg: 'transparent',
      fg: theme.colors.primary,
      border: 'transparent',
    },
    danger: {
      bg: theme.colors.coral,
      fg: theme.colors.white,
      border: theme.colors.coral,
    },
  }[variant];

  const animateTo = (to: number) => {
    Animated.spring(scale, {
      toValue: to,
      useNativeDriver: true,
      speed: theme.reduceMotion ? 100 : 40,
      bounciness: theme.reduceMotion ? 0 : 6,
    }).start();
  };

  return (
    <Animated.View style={[{ transform: [{ scale }], alignSelf: 'stretch' }, style]}>
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ disabled: busy, busy: loading }}
        disabled={busy}
        onPressIn={() => {
          if (!theme.reduceMotion) animateTo(0.97);
        }}
        onPressOut={() => animateTo(1)}
        onPress={() => {
          void Haptics.selectionAsync();
          onPress();
        }}
        style={{
          minHeight: compact ? 40 : 48,
          paddingHorizontal: compact ? theme.space.md : theme.space.lg,
          paddingVertical: compact ? theme.space.sm : theme.space.md,
          borderRadius: theme.radii.md,
          backgroundColor: palette.bg,
          borderWidth: variant === 'secondary' ? 1 : 0,
          borderColor: palette.border,
          alignItems: 'center',
          justifyContent: 'center',
          opacity: busy ? 0.55 : 1,
          flexDirection: 'row',
          gap: theme.space.sm,
        }}
      >
        {loading ? (
          <ActivityIndicator color={palette.fg} />
        ) : (
          <Text
            style={{
              fontFamily: theme.fonts.bodySemiBold,
              fontSize: compact
                ? theme.typography.bodySmall.fontSize
                : theme.typography.body.fontSize,
              // Avoid extra lineHeight — it vertically offsets text inside flex-centered buttons.
              color: palette.fg,
              textAlign: 'center',
              includeFontPadding: false,
            }}
            allowFontScaling
          >
            {label}
          </Text>
        )}
      </Pressable>
    </Animated.View>
  );
}
