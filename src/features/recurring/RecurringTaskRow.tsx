import type { ReactNode } from 'react';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Pressable, Text, View } from 'react-native';

import { useTheme, type FrequencyColors } from '@/design';
import { useT } from '@/i18n';

import type { TickOutcome } from './api';

/** One tickable recurring task; a tick counts for the current period. */
export function RecurringTaskRow({
  title,
  caption,
  note,
  done,
  outcome = null,
  disabled,
  onToggle,
  onBlock,
  onAssign,
  onLongPress,
  onPressOut,
  delayLongPress,
  cancelable,
  assignLabel,
  accent,
  grouped = false,
  divider = false,
  trailing,
}: {
  title: string;
  caption?: string | null;
  note?: string | null;
  done: boolean;
  outcome?: TickOutcome | null;
  disabled?: boolean;
  onToggle?: () => void;
  onBlock?: () => void;
  onAssign?: () => void;
  onLongPress?: () => void;
  onPressOut?: () => void;
  delayLongPress?: number;
  cancelable?: boolean;
  assignLabel?: string;
  /** Frequency colors for the checkbox fill and caption. */
  accent?: FrequencyColors;
  /** Row inside a shared card: no own border, optional hairline divider below. */
  grouped?: boolean;
  divider?: boolean;
  trailing?: ReactNode;
}) {
  const t = useT();
  const theme = useTheme();
  const copy = t().recurring;
  const runsCopy = t().runs;
  const tickable = Boolean(onToggle) && !disabled;
  const fill = accent?.base ?? theme.colors.primary;
  const blocked = outcome === 'blocked';
  const pressable = tickable || Boolean(onLongPress);

  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: theme.space.md,
        minHeight: 56,
        paddingVertical: theme.space.sm,
        paddingHorizontal: theme.space.xl - 4,
        backgroundColor: blocked
          ? theme.colors.alertTint
          : grouped
            ? 'transparent'
            : theme.colors.card,
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
      }}
    >
      <Pressable
        accessibilityRole="checkbox"
        accessibilityState={{ checked: done && !blocked, disabled: !tickable }}
        accessibilityHint={tickable ? (done ? copy.markNotDone : copy.markDone) : undefined}
        disabled={!pressable}
        onPress={onToggle}
        onLongPress={onLongPress}
        onPressOut={onPressOut}
        delayLongPress={delayLongPress}
        cancelable={cancelable}
        style={({ pressed }) => ({
          flex: 1,
          flexDirection: 'row',
          alignItems: 'center',
          gap: theme.space.lg,
          opacity: pressed ? 0.85 : 1,
        })}
      >
        {onToggle ? (
          <View
            style={{
              width: 26,
              height: 26,
              borderRadius: 13,
              borderWidth: done && !blocked ? 0 : 1.5,
              borderColor: blocked ? theme.colors.coral : theme.colors.borderStrong,
              backgroundColor: done && !blocked ? fill : theme.colors.white,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            {done && !blocked ? (
              <Ionicons name="checkmark" size={18} color="#FFFFFF" />
            ) : blocked ? (
              <Ionicons name="alert" size={14} color={theme.colors.coral} />
            ) : null}
          </View>
        ) : (
          <Ionicons name="ellipse-outline" size={10} color={theme.colors.inkSubtle} />
        )}
        <View style={{ flex: 1, gap: 2, opacity: done && !blocked ? 0.6 : 1 }}>
          <Text
            style={{
              fontFamily: done && !blocked ? theme.fonts.bodyMedium : theme.fonts.bodyBold,
              fontSize: theme.typography.body.fontSize,
              lineHeight: theme.typography.body.lineHeight,
              color: theme.colors.ink,
              textDecorationLine: done && !blocked ? 'line-through' : 'none',
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
          {blocked ? (
            <Text
              style={{
                fontFamily: theme.fonts.bodyMedium,
                fontSize: theme.typography.caption.fontSize,
                lineHeight: theme.typography.caption.lineHeight,
                color: theme.colors.coral,
              }}
              numberOfLines={2}
              allowFontScaling
            >
              {note ? `${runsCopy.blocked} · ${note}` : runsCopy.blocked}
            </Text>
          ) : null}
        </View>
      </Pressable>
      {onBlock && tickable && !blocked ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={runsCopy.blocked}
          onPress={onBlock}
          hitSlop={8}
          style={({ pressed }) => ({
            width: 36,
            height: 30,
            borderRadius: theme.radii.pill,
            borderWidth: 0.5,
            borderColor: theme.colors.border,
            backgroundColor: pressed ? theme.colors.sand : theme.colors.white,
            alignItems: 'center',
            justifyContent: 'center',
          })}
        >
          <Ionicons name="warning-outline" size={15} color={theme.colors.coral} />
        </Pressable>
      ) : null}
      {onAssign && trailing ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={assignLabel}
          onPress={onAssign}
          hitSlop={8}
          style={({ pressed }) => ({ opacity: pressed ? 0.75 : 1 })}
        >
          {trailing}
        </Pressable>
      ) : (
        trailing
      )}
    </View>
  );
}
