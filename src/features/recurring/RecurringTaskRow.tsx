import Ionicons from '@expo/vector-icons/Ionicons';
import { Pressable, Text, View } from 'react-native';

import { useTheme } from '@/design';
import { t } from '@/i18n';

/** One tickable recurring task; a tick counts for the current period. */
export function RecurringTaskRow({
  title,
  caption,
  done,
  disabled,
  onToggle,
}: {
  title: string;
  caption?: string | null;
  done: boolean;
  disabled?: boolean;
  onToggle?: () => void;
}) {
  const theme = useTheme();
  const copy = t().recurring;
  const tickable = Boolean(onToggle) && !disabled;

  return (
    <Pressable
      accessibilityRole="checkbox"
      accessibilityState={{ checked: done, disabled: !tickable }}
      accessibilityHint={tickable ? (done ? copy.markNotDone : copy.markDone) : undefined}
      disabled={!tickable}
      onPress={onToggle}
      style={({ pressed }) => ({
        flexDirection: 'row',
        alignItems: 'center',
        gap: theme.space.md,
        minHeight: 52,
        paddingVertical: theme.space.sm,
        paddingHorizontal: theme.space.md,
        borderRadius: theme.radii.sm,
        backgroundColor: theme.colors.white,
        borderWidth: 1,
        borderColor: theme.colors.border,
        opacity: pressed ? 0.75 : 1,
      })}
    >
      {onToggle ? (
        <View
          style={{
            width: 26,
            height: 26,
            borderRadius: 7,
            borderWidth: done ? 0 : 2,
            borderColor: theme.colors.borderStrong,
            backgroundColor: done ? theme.colors.primary : theme.colors.white,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          {done ? <Ionicons name="checkmark" size={18} color="#FFFFFF" /> : null}
        </View>
      ) : (
        <Ionicons name="ellipse-outline" size={10} color={theme.colors.inkSubtle} />
      )}
      <View style={{ flex: 1, gap: 2 }}>
        <Text
          style={{
            fontFamily: theme.fonts.body,
            fontSize: theme.typography.body.fontSize,
            lineHeight: theme.typography.body.lineHeight,
            color: done ? theme.colors.inkMuted : theme.colors.ink,
            textDecorationLine: done ? 'line-through' : 'none',
          }}
          allowFontScaling
        >
          {title}
        </Text>
        {caption ? (
          <Text
            style={{
              fontFamily: theme.fonts.bodyMedium,
              fontSize: theme.typography.caption.fontSize,
              color: theme.colors.inkSubtle,
            }}
            allowFontScaling
          >
            {caption}
          </Text>
        ) : null}
      </View>
    </Pressable>
  );
}
