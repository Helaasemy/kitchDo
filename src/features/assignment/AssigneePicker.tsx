import { Pressable, Text, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';

import { Sheet } from '@/components/ui';
import { useTheme } from '@/design';
import { useT } from '@/i18n';
import type { KitchenMember } from '@/features/membership';

import { AssigneeAvatar } from './AssigneeAvatar';

export type AssigneePick =
  | { kind: 'inherit' }
  | { kind: 'anyone' }
  | { kind: 'member'; userId: string };

export function AssigneePicker({
  visible,
  onClose,
  members,
  currentUserId,
  inheritMember,
  inheritSelected = false,
  selectedUserId,
  onPick,
}: {
  visible: boolean;
  onClose: () => void;
  members: KitchenMember[];
  currentUserId?: string;
  inheritMember?: { userId: string; name: string } | null;
  inheritSelected?: boolean;
  selectedUserId: string | null;
  onPick: (pick: AssigneePick) => void;
}) {
  const t = useT();
  const copy = t().assignment;
  const you = t().invite.you;

  const choose = (pick: AssigneePick) => {
    onPick(pick);
    onClose();
  };

  return (
    <Sheet visible={visible} title={copy.pickerTitle} onClose={onClose}>
      {inheritMember ? (
        <PickerRow
          name={copy.inheritHint.replace('{name}', inheritMember.name)}
          avatarName={inheritMember.name}
          userId={inheritMember.userId}
          selected={inheritSelected}
          onPress={() => choose({ kind: 'inherit' })}
        />
      ) : null}
      <PickerRow
        name={copy.anyone}
        caption={copy.anyoneHint}
        selected={!inheritSelected && selectedUserId == null}
        onPress={() => choose({ kind: 'anyone' })}
      />
      {members.map((member) => (
        <PickerRow
          key={member.userId}
          name={
            member.userId === currentUserId
              ? `${member.displayName} · ${you}`
              : member.displayName
          }
          userId={member.userId}
          selected={!inheritSelected && selectedUserId === member.userId}
          onPress={() => choose({ kind: 'member', userId: member.userId })}
        />
      ))}
    </Sheet>
  );
}

function PickerRow({
  name,
  avatarName,
  caption,
  userId,
  selected,
  onPress,
}: {
  name: string;
  avatarName?: string;
  caption?: string;
  userId?: string;
  selected: boolean;
  onPress: () => void;
}) {
  const theme = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected }}
      onPress={onPress}
      style={({ pressed }) => ({
        flexDirection: 'row',
        alignItems: 'center',
        gap: theme.space.md,
        minHeight: 64,
        paddingVertical: theme.space.md,
        borderBottomWidth: 0.5,
        borderBottomColor: theme.colors.border,
        opacity: pressed ? 0.85 : 1,
      })}
    >
      <AssigneeAvatar name={avatarName ?? name} userId={userId ?? null} size={40} />
      <View style={{ flex: 1, gap: 2 }}>
        <Text
          style={{
            fontFamily: theme.fonts.bodyBold,
            fontSize: theme.typography.body.fontSize,
            color: theme.colors.ink,
          }}
          allowFontScaling
        >
          {name}
        </Text>
        {caption ? (
          <Text
            style={{
              fontFamily: theme.fonts.bodyMedium,
              fontSize: theme.typography.caption.fontSize,
              color: theme.colors.inkMuted,
            }}
            allowFontScaling
          >
            {caption}
          </Text>
        ) : null}
      </View>
      {selected ? (
        <Ionicons name="checkmark" size={20} color={theme.colors.primary} />
      ) : null}
    </Pressable>
  );
}
