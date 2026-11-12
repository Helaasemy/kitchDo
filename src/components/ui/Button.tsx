import { useState, type ComponentProps } from 'react';
import {
  ActivityIndicator,
  Animated,
  Pressable,
  Text,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
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
  icon?: ComponentProps<typeof Ionicons>['name'];
};

export function Button({
  label,
  onPress,
  variant = 'primary',
  disabled = false,
  loading = false,
  style,
  compact = false,
  icon,
}: Props) {
  const theme = useTheme();
  const [scale] = useState(() => new Animated.Value(1));
  const busy = disabled || loading;

  const palette = {
    primary: {
      bg: theme.colors.primary,
      fg: theme.colors.onPrimary,
      border: theme.colors.primary,
    },
    secondary: {
      bg: theme.colors.white,
      fg: theme.colors.ink,
      border: theme.colors.border,
    },
    ghost: {
      bg: 'transparent',
      fg: theme.colors.primary,
      border: 'transparent',
    },
    danger: {
      bg: theme.colors.white,
      fg: theme.colors.coral,
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

  const textSize = compact
    ? theme.typography.bodySmall.fontSize
    : theme.typography.body.fontSize;

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
          minHeight: compact ? 44 : 52,
          paddingHorizontal: compact ? theme.space.lg : theme.space.xl,
          paddingVertical: compact ? theme.space.sm : theme.space.md,
          borderRadius: theme.radii.pill,
          backgroundColor: palette.bg,
          borderWidth: variant === 'secondary' || variant === 'danger' ? 0.5 : 0,
          borderColor: palette.border,
          boxShadow:
            variant === 'primary' || variant === 'secondary' ? theme.shadows.soft : undefined,
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
          <>
            {icon ? <Ionicons name={icon} size={textSize + 2} color={palette.fg} /> : null}
            <Text
              style={{
                fontFamily: theme.fonts.bodyBold,
                fontSize: textSize,
                // Avoid extra lineHeight — it vertically offsets text inside flex-centered buttons.
                color: palette.fg,
                textAlign: 'center',
                includeFontPadding: false,
              }}
              allowFontScaling
            >
              {label}
            </Text>
          </>
        )}
      </Pressable>
    </Animated.View>
  );
}
