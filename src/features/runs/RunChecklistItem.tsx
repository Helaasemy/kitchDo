import type { ComponentProps } from 'react';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Pressable, Text, View } from 'react-native';

import { useTheme } from '@/design';
import type { RunItemView } from '@/features/runs/types';
import { t } from '@/i18n';

type Props = {
  item: RunItemView;
  busy?: boolean;
  instructionsOpen?: boolean;
  /** Hairline under the row when more rows follow in the same card. */
  divider?: boolean;
  onToggleDone: () => void;
  onNotApplicable: () => void;
  onBlocked: () => void;
  onToggleInstructions: () => void;
  onResolveIssue?: () => void;
};

function CheckboxGlyph({ outcome }: { outcome: RunItemView['outcome'] }) {
  const theme = useTheme();
  const base = {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  };

  if (outcome === 'done') {
    return (
      <View style={{ ...base, backgroundColor: theme.colors.primary }}>
        <Ionicons name="checkmark" size={18} color="#FFFFFF" />
      </View>
    );
  }
  if (outcome === 'not_applicable') {
    return (
      <View style={{ ...base, backgroundColor: theme.colors.sand }}>
        <Ionicons name="remove" size={18} color={theme.colors.inkMuted} />
      </View>
    );
  }
  if (outcome === 'blocked') {
    return (
      <View
        style={{
          ...base,
          borderWidth: 1.5,
          borderColor: theme.colors.coral,
          backgroundColor: theme.colors.white,
        }}
      >
        <Ionicons name="alert" size={16} color={theme.colors.coral} />
      </View>
    );
  }
  return (
    <View
      style={{
        ...base,
        borderWidth: 1.5,
        borderColor: theme.colors.borderStrong,
        backgroundColor: theme.colors.white,
      }}
    />
  );
}

function ActionPill({
  label,
  icon,
  accessibilityLabel,
  danger,
  onPress,
  disabled,
}: {
  label?: string;
  icon?: ComponentProps<typeof Ionicons>['name'];
  accessibilityLabel: string;
  danger?: boolean;
  onPress: () => void;
  disabled?: boolean;
}) {
  const theme = useTheme();
  const color = danger ? theme.colors.coral : theme.colors.inkMuted;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      hitSlop={{ top: 8, bottom: 8, left: 2, right: 2 }}
      style={({ pressed }) => ({
        minWidth: 36,
        height: 30,
        paddingHorizontal: theme.space.md - 2,
        borderRadius: theme.radii.pill,
        borderWidth: 0.5,
        borderColor: theme.colors.border,
        backgroundColor: pressed ? theme.colors.sand : theme.colors.white,
        alignItems: 'center',
        justifyContent: 'center',
        opacity: disabled ? 0.4 : 1,
      })}
    >
      {icon ? (
        <Ionicons name={icon} size={15} color={color} />
      ) : (
        <Text
          style={{
            fontFamily: theme.fonts.label,
            fontSize: 10,
            lineHeight: 13,
            letterSpacing: 0.4,
            color,
          }}
          allowFontScaling
        >
          {label}
        </Text>
      )}
    </Pressable>
  );
}

function StatusTag({ label, danger }: { label: string; danger?: boolean }) {
  const theme = useTheme();
  return (
    <View
      style={{
        alignSelf: 'flex-start',
        paddingHorizontal: theme.space.sm,
        paddingVertical: 2,
        borderRadius: theme.radii.pill,
        backgroundColor: danger ? theme.colors.coral : theme.colors.sand,
      }}
    >
      <Text
        style={{
          fontFamily: theme.fonts.label,
          fontSize: 10,
          lineHeight: 13,
          letterSpacing: 0.6,
          textTransform: 'uppercase',
          color: danger ? '#FFFFFF' : theme.colors.inkMuted,
        }}
        allowFontScaling
      >
        {label}
      </Text>
    </View>
  );
}

export function RunChecklistItem({
  item,
  busy = false,
  instructionsOpen = false,
  divider = false,
  onToggleDone,
  onNotApplicable,
  onBlocked,
  onToggleInstructions,
  onResolveIssue,
}: Props) {
  const theme = useTheme();
  const copy = t().runs;
  const isDone = item.outcome === 'done';
  const isNa = item.outcome === 'not_applicable';
  const isBlocked = item.outcome === 'blocked';

  const checkboxLabel =
    item.outcome === 'pending'
      ? copy.markDone
      : item.outcome === 'done'
        ? copy.uncheckDone
        : copy.reopen;

  return (
    <View
      style={{
        paddingVertical: theme.space.lg,
        paddingHorizontal: theme.space.xl - 4,
        gap: theme.space.md,
        borderBottomWidth: divider ? 0.5 : 0,
        borderBottomColor: theme.colors.border,
        backgroundColor: isBlocked ? theme.colors.alertTint : 'transparent',
        opacity: busy ? 0.65 : 1,
      }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.space.md }}>
        <Pressable
          accessibilityRole="checkbox"
          accessibilityState={{ checked: isDone, busy, disabled: busy }}
          accessibilityLabel={`${item.title}, ${checkboxLabel}`}
          disabled={busy}
          onPress={onToggleDone}
          hitSlop={8}
          style={{
            width: 36,
            height: 44,
            marginLeft: -4,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <CheckboxGlyph outcome={item.outcome} />
        </Pressable>

        <Pressable
          onPress={item.instructions ? onToggleInstructions : undefined}
          disabled={!item.instructions}
          accessibilityHint={
            item.instructions
              ? instructionsOpen
                ? copy.hideInstructions
                : copy.showInstructions
              : undefined
          }
          style={{ flex: 1, minWidth: 0, gap: 2, opacity: isDone ? 0.45 : isNa ? 0.55 : 1 }}
        >
          <Text
            style={{
              fontFamily: theme.fonts.bodyBold,
              fontSize: theme.typography.body.fontSize,
              lineHeight: theme.typography.body.lineHeight,
              color: theme.colors.ink,
              textDecorationLine: isDone ? 'line-through' : 'none',
            }}
            allowFontScaling
          >
            {item.title}
          </Text>
          {item.instructions ? (
            <Text
              style={{
                fontFamily: theme.fonts.body,
                fontSize: theme.typography.caption.fontSize,
                lineHeight: theme.typography.caption.lineHeight,
                color: theme.colors.inkMuted,
              }}
              numberOfLines={instructionsOpen ? undefined : 1}
              allowFontScaling
            >
              {item.instructions}
            </Text>
          ) : null}
          {isNa ? <StatusTag label={copy.notApplicableShort} /> : null}
        </Pressable>

        {isBlocked ? (
          <StatusTag label={copy.blocked} danger />
        ) : (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <ActionPill
              label={copy.notApplicableShort}
              accessibilityLabel={copy.notApplicable}
              onPress={onNotApplicable}
              disabled={busy || isNa}
            />
            <ActionPill
              icon="warning-outline"
              accessibilityLabel={copy.blocked}
              danger
              onPress={onBlocked}
              disabled={busy}
            />
          </View>
        )}
      </View>

      {item.note ? (
        <View
          style={{
            marginLeft: 44,
            flexDirection: 'row',
            alignItems: 'flex-start',
            gap: theme.space.sm,
            padding: theme.space.sm + 2,
            borderRadius: theme.radii.sm,
            backgroundColor: isBlocked ? theme.colors.white : theme.colors.sand,
          }}
        >
          <Ionicons
            name="chatbox-ellipses"
            size={14}
            color={isBlocked ? theme.colors.coral : theme.colors.inkMuted}
            style={{ marginTop: 2 }}
          />
          <Text
            style={{
              flex: 1,
              fontFamily: theme.fonts.bodyMedium,
              color: isBlocked ? theme.colors.coral : theme.colors.inkMuted,
              fontSize: theme.typography.caption.fontSize,
              lineHeight: theme.typography.caption.lineHeight,
            }}
            allowFontScaling
          >
            {item.note}
          </Text>
        </View>
      ) : null}

      {item.issueId && item.issueState === 'open' && onResolveIssue ? (
        <Pressable
          accessibilityRole="button"
          onPress={onResolveIssue}
          disabled={busy}
          hitSlop={8}
          style={{ marginLeft: 44, minHeight: 32, justifyContent: 'center' }}
        >
          <Text
            style={{
              fontFamily: theme.fonts.bodyExtraBold,
              color: theme.colors.coral,
              fontSize: theme.typography.caption.fontSize,
            }}
            allowFontScaling
          >
            {copy.resolveIssue}
          </Text>
        </Pressable>
      ) : null}
    </View>
  );
}
