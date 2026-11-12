import { Pressable, Text, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';

import { PaperCard } from '@/components/ui';
import { useTheme } from '@/design';
import type { KitchenMember } from '@/features/membership';
import { useT } from '@/i18n';

import { AssigneeAvatar } from './AssigneeAvatar';
import {
  effectiveAssignee,
  itemAssignmentKind,
  type ItemAssignment,
} from './resolve';

export function AssignedToCard({
  label,
  hint,
  anyoneLabel,
  member,
  readOnly,
  onPress,
}: {
  label: string;
  hint: string;
  anyoneLabel: string;
  member: KitchenMember | null;
  readOnly: boolean;
  onPress: () => void;
}) {
  const theme = useTheme();
  return (
    <View style={{ gap: theme.space.sm }}>
      <Text
        style={{
          fontFamily: theme.fonts.label,
          fontSize: theme.typography.chip.fontSize,
          color: theme.colors.inkMuted,
          textTransform: 'uppercase',
          letterSpacing: 0.9,
          paddingLeft: theme.space.xs,
        }}
        allowFontScaling
      >
        {label}
      </Text>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={label}
        disabled={readOnly}
        onPress={onPress}
      >
        <PaperCard>
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: theme.space.md,
              padding: theme.space.lg,
            }}
          >
            <AssigneeAvatar
              size={40}
              userId={member?.userId ?? null}
              name={member?.displayName ?? null}
            />
            <View style={{ flex: 1, gap: 2 }}>
              <Text
                style={{
                  fontFamily: theme.fonts.bodyExtraBold,
                  fontSize: theme.typography.body.fontSize,
                  color: theme.colors.ink,
                }}
                allowFontScaling
              >
                {member?.displayName ?? anyoneLabel}
              </Text>
              <Text
                style={{
                  fontFamily: theme.fonts.body,
                  fontSize: theme.typography.caption.fontSize,
                  color: theme.colors.inkMuted,
                }}
                allowFontScaling
              >
                {hint}
              </Text>
            </View>
            {readOnly ? null : (
              <Ionicons name="chevron-forward" size={16} color={theme.colors.inkSubtle} />
            )}
          </View>
        </PaperCard>
      </Pressable>
    </View>
  );
}

export function TaskAssigneeRow({
  assignment,
  listAssigneeUserId,
  members,
  readOnly,
  onPress,
}: {
  assignment: ItemAssignment;
  listAssigneeUserId: string | null;
  members: KitchenMember[];
  readOnly: boolean;
  onPress: () => void;
}) {
  const t = useT();
  const theme = useTheme();
  const copy = t().assignment;
  const kind = itemAssignmentKind(listAssigneeUserId, assignment);
  const effectiveId = effectiveAssignee(listAssigneeUserId, assignment);
  const name =
    members.find((m) => m.userId === effectiveId)?.displayName ?? copy.anyone;
  const caption =
    kind === 'inherit' && effectiveId
      ? copy.inheritHint.replace('{name}', name)
      : kind === 'anyone'
        ? copy.anyone
        : name;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={copy.listLabel}
      disabled={readOnly}
      onPress={onPress}
      hitSlop={8}
      style={({ pressed }) => ({
        flexDirection: 'row',
        alignItems: 'center',
        gap: theme.space.sm,
        minHeight: 44,
        opacity: pressed ? 0.85 : 1,
      })}
    >
      <AssigneeAvatar
        size={28}
        userId={effectiveId}
        name={name}
        override={kind === 'override'}
      />
      <Text
        style={{
          flex: 1,
          fontFamily: kind === 'override' ? theme.fonts.bodyExtraBold : theme.fonts.body,
          fontSize: theme.typography.bodySmall.fontSize,
          color: kind === 'inherit' || kind === 'anyone' ? theme.colors.inkMuted : theme.colors.ink,
        }}
        allowFontScaling
      >
        {caption}
      </Text>
      {readOnly ? null : (
        <Ionicons name="chevron-forward" size={14} color={theme.colors.inkSubtle} />
      )}
    </Pressable>
  );
}
