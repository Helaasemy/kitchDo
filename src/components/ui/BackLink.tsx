import { Pressable, Text } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import type { Href } from 'expo-router';

import { useTheme } from '@/design';
import { useT } from '@/i18n';
import { goBackOr } from '@/lib/navigation';

/** Chevron + label back control for pushed screens. */
export function BackLink({
  label,
  fallback,
  onPress,
}: {
  label?: string;
  fallback: Href;
  onPress?: () => void;
}) {
  const t = useT();
  const theme = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress ?? (() => goBackOr(fallback))}
      hitSlop={12}
      style={({ pressed }) => ({
        alignSelf: 'flex-start',
        minHeight: 44,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 2,
        marginLeft: -6,
        opacity: pressed ? 0.7 : 1,
      })}
    >
      <Ionicons name="chevron-back" size={22} color={theme.colors.primary} />
      <Text
        style={{
          fontFamily: theme.fonts.bodyBold,
          color: theme.colors.primary,
          fontSize: theme.typography.body.fontSize,
        }}
        allowFontScaling
      >
        {label ?? t().common.back}
      </Text>
    </Pressable>
  );
}
