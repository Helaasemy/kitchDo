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
  onToggleDone: () => void;
  onNotApplicable: () => void;
  onBlocked: () => void;
  onToggleInstructions: () => void;
  onResolveIssue?: () => void;
};

function CheckboxGlyph({
  outcome,
}: {
  outcome: RunItemView['outcome'];
}) {
  const theme = useTheme();
  const size = 22;

  if (outcome === 'done') {
    return (
      <View
        style={{
          width: 26,
          height: 26,
          borderRadius: 7,
          backgroundColor: theme.colors.primary,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Ionicons name="checkmark" size={size - 4} color="#FFFFFF" />
      </View>
    );
  }

  if (outcome === 'not_applicable') {
    return (
      <View
        style={{
          width: 26,
          height: 26,
          borderRadius: 7,
          borderWidth: 2,
          borderColor: theme.colors.inkSubtle,
          backgroundColor: theme.colors.sand,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Ionicons name="remove" size={size - 4} color={theme.colors.inkSubtle} />
      </View>
    );
  }

  if (outcome === 'blocked') {
    return (
      <View
        style={{
          width: 26,
          height: 26,
          borderRadius: 7,
          borderWidth: 2,
          borderColor: theme.colors.coral,
          backgroundColor: theme.colors.white,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Ionicons
          name="alert"
          size={size - 6}
          color={theme.colors.coral}
        />
      </View>
    );
  }

  return (
    <View
      style={{
        width: 26,
        height: 26,
        borderRadius: 7,
        borderWidth: 2,
        borderColor: theme.colors.borderStrong,
        backgroundColor: theme.colors.white,
      }}
    />
  );
}

function ActionIcon({
  name,
  label,
  active,
  danger,
  onPress,
  disabled,
}: {
  name: ComponentProps<typeof Ionicons>['name'];
  label: string;
  active?: boolean;
  danger?: boolean;
  onPress: () => void;
  disabled?: boolean;
}) {
  const theme = useTheme();
  const color = danger
    ? theme.colors.coral
    : active
      ? theme.colors.primary
      : theme.colors.inkSubtle;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ selected: Boolean(active), disabled }}
      disabled={disabled}
      onPress={onPress}
      hitSlop={6}
      style={({ pressed }) => ({
        width: 40,
        height: 40,
        borderRadius: theme.radii.sm,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: active
          ? danger
            ? 'rgba(225, 29, 72, 0.1)'
            : 'rgba(15, 118, 110, 0.1)'
          : 'transparent',
        opacity: disabled ? 0.4 : pressed ? 0.7 : 1,
      })}
    >
      <Ionicons name={name} size={20} color={color} />
    </Pressable>
  );
}

export function RunChecklistItem({
  item,
  busy = false,
  instructionsOpen = false,
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
  const titleMuted = isDone || isNa;

  const checkboxLabel =
    item.outcome === 'pending'
      ? copy.markDone
      : item.outcome === 'done'
        ? copy.uncheckDone
        : copy.reopen;

  return (
    <View
      style={{
        borderBottomWidth: 1,
        borderBottomColor: theme.colors.border,
        paddingVertical: theme.space.sm,
        opacity: busy ? 0.65 : 1,
        gap: theme.space.xs,
      }}
    >
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: theme.space.sm,
        }}
      >
        <Pressable
          accessibilityRole="checkbox"
          accessibilityState={{
            checked: isDone,
            busy,
            disabled: busy,
          }}
          accessibilityLabel={checkboxLabel}
          disabled={busy}
          onPress={onToggleDone}
          hitSlop={8}
          style={{
            width: 44,
            height: 44,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <CheckboxGlyph outcome={item.outcome} />
        </Pressable>

        <Pressable
          onPress={item.instructions ? onToggleInstructions : undefined}
          disabled={!item.instructions}
          style={{ flex: 1, minWidth: 0, gap: 2 }}
        >
          <Text
            style={{
              fontFamily: theme.fonts.bodyMedium,
              fontSize: theme.typography.body.fontSize,
              lineHeight: theme.typography.body.lineHeight,
              color: titleMuted ? theme.colors.inkMuted : theme.colors.ink,
              textDecorationLine: isDone ? 'line-through' : 'none',
            }}
            allowFontScaling
          >
            {item.title}
          </Text>
          {item.instructions && !instructionsOpen ? (
            <Text
              style={{
                fontFamily: theme.fonts.body,
                fontSize: theme.typography.caption.fontSize,
                lineHeight: theme.typography.caption.lineHeight,
                color: theme.colors.primary,
              }}
              numberOfLines={1}
              allowFontScaling
            >
              {copy.showInstructions}
            </Text>
          ) : null}
          {isNa || isBlocked ? (
            <Text
              style={{
                fontFamily: theme.fonts.label,
                fontSize: theme.typography.label.fontSize,
                color: isBlocked ? theme.colors.coral : theme.colors.inkSubtle,
                textTransform: 'uppercase',
              }}
              allowFontScaling
            >
              {isBlocked ? copy.blocked : copy.notApplicable}
            </Text>
          ) : null}
        </Pressable>

        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <ActionIcon
            name="ban-outline"
            label={copy.notApplicable}
            active={isNa}
            onPress={onNotApplicable}
            disabled={busy || isNa}
          />
          <ActionIcon
            name="warning-outline"
            label={copy.blocked}
            active={isBlocked}
            danger
            onPress={onBlocked}
            disabled={busy || isBlocked}
          />
        </View>
      </View>

      {instructionsOpen && item.instructions ? (
        <Pressable
          onPress={onToggleInstructions}
          style={{ marginLeft: 52, gap: 2 }}
        >
          <Text
            style={{
              fontFamily: theme.fonts.body,
              color: theme.colors.inkMuted,
              fontSize: theme.typography.bodySmall.fontSize,
              lineHeight: theme.typography.bodySmall.lineHeight,
            }}
            allowFontScaling
          >
            {item.instructions}
          </Text>
          <Text
            style={{
              fontFamily: theme.fonts.bodyMedium,
              color: theme.colors.primary,
              fontSize: theme.typography.caption.fontSize,
            }}
            allowFontScaling
          >
            {copy.hideInstructions}
          </Text>
        </Pressable>
      ) : null}

      {item.note ? (
        <Text
          style={{
            marginLeft: 52,
            fontFamily: theme.fonts.body,
            color: theme.colors.inkMuted,
            fontSize: theme.typography.caption.fontSize,
            lineHeight: theme.typography.caption.lineHeight,
          }}
          allowFontScaling
        >
          {item.note}
        </Text>
      ) : null}

      {item.issueId && item.issueState === 'open' && onResolveIssue ? (
        <Pressable
          onPress={onResolveIssue}
          disabled={busy}
          style={{ marginLeft: 52, paddingVertical: theme.space.xs }}
        >
          <Text
            style={{
              fontFamily: theme.fonts.bodyMedium,
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
