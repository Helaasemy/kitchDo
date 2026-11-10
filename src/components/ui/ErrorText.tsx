import { Text, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';

import { useTheme } from '@/design';

/**
 * Inline error. `boxed` draws the alert-tint box used on auth forms;
 * the default is plain coral caption text.
 */
export function ErrorText({
  message,
  boxed = false,
}: {
  message: string | null | undefined;
  boxed?: boolean;
}) {
  const theme = useTheme();
  if (!message) return null;

  const text = (
    <Text
      style={{
        flex: boxed ? 1 : undefined,
        fontFamily: boxed ? theme.fonts.bodySemiBold : theme.fonts.body,
        fontSize: theme.typography.caption.fontSize,
        lineHeight: theme.typography.caption.lineHeight,
        color: theme.colors.coral,
      }}
      allowFontScaling
    >
      {message}
    </Text>
  );

  if (!boxed) {
    return <View accessibilityLiveRegion="polite">{text}</View>;
  }

  return (
    <View
      accessibilityLiveRegion="polite"
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: theme.space.sm,
        padding: theme.space.md,
        borderRadius: theme.radii.sm,
        backgroundColor: theme.colors.alertTint,
      }}
    >
      <Ionicons name="alert-circle" size={18} color={theme.colors.coral} />
      {text}
    </View>
  );
}
