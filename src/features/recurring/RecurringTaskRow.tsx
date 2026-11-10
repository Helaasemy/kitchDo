import Ionicons from '@expo/vector-icons/Ionicons';
import { Pressable, Text, View } from 'react-native';

import { useTheme, type FrequencyColors } from '@/design';
import { useT } from '@/i18n';

/** One tickable recurring task; a tick counts for the current period. */
export function RecurringTaskRow({
  title,
  caption,
  done,
  disabled,
  onToggle,
  accent,
  grouped = false,
  divider = false,
}: {
  title: string;
  caption?: string | null;
  done: boolean;
  disabled?: boolean;
  onToggle?: () => void;
  /** Frequency colors for the checkbox fill and caption. */
  accent?: FrequencyColors;
  /** Row inside a shared card: no own border, optional hairline divider below. */
  grouped?: boolean;
  divider?: boolean;
}) {
  const t = useT();
  const theme = useTheme();
  const copy = t().recurring;
  const tickable = Boolean(onToggle) && !disabled;
  const fill = accent?.base ?? theme.colors.primary;

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
        gap: theme.space.lg,
        minHeight: 56,
        paddingVertical: theme.space.sm,
        paddingHorizontal: theme.space.xl - 4,
        backgroundColor: pressed ? theme.colors.sand : grouped ? 'transparent' : theme.colors.card,
        ...(grouped
          ? {
              borderBottomWidth: divider ? 0.5 : 0,
              borderBottomColor: theme.colors.border,
            }
          : {
              borderRadius: theme.radii.xl,
              borderWidth: 0.5,
              borderColor: theme.colors.border,
              boxShadow: theme.shadows.soft,
            }),
      })}
    >
      {onToggle ? (
        <View
          style={{
            width: 26,
            height: 26,
            borderRadius: 13,
            borderWidth: done ? 0 : 1.5,
            borderColor: theme.colors.borderStrong,
            backgroundColor: done ? fill : theme.colors.white,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          {done ? <Ionicons name="checkmark" size={18} color="#FFFFFF" /> : null}
        </View>
      ) : (
        <Ionicons name="ellipse-outline" size={10} color={theme.colors.inkSubtle} />
      )}
      <View style={{ flex: 1, gap: 2, opacity: done ? 0.6 : 1 }}>
        <Text
          style={{
            fontFamily: done ? theme.fonts.bodyMedium : theme.fonts.bodyBold,
            fontSize: theme.typography.body.fontSize,
            lineHeight: theme.typography.body.lineHeight,
            color: theme.colors.ink,
            textDecorationLine: done ? 'line-through' : 'none',
          }}
          allowFontScaling
        >
          {title}
        </Text>
        {caption ? (
          <Text
            style={{
              fontFamily: theme.fonts.bodyBold,
              fontSize: theme.typography.label.fontSize,
              lineHeight: theme.typography.label.lineHeight,
              letterSpacing: 0.8,
              textTransform: 'uppercase',
              color: accent?.text ?? theme.colors.inkSubtle,
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
