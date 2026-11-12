import { Text, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';

import { useTheme, type FrequencyColors } from '@/design';

const TONES = ['daily', 'weekly', 'monthly'] as const;

function toneFor(userId: string): (typeof TONES)[number] {
  let n = 0;
  for (let i = 0; i < userId.length; i += 1) {
    n = (n + userId.charCodeAt(i)) % TONES.length;
  }
  return TONES[n];
}

export function assigneeInitial(name: string): string {
  const trimmed = name.trim();
  return trimmed ? trimmed.slice(0, 1).toUpperCase() : '?';
}

/** 28px task-row or 40px list-card initial. Dashed empty state is Anyone. */
export function AssigneeAvatar({
  name,
  userId,
  size = 40,
  override = false,
}: {
  name?: string | null;
  userId?: string | null;
  size?: 28 | 40;
  override?: boolean;
}) {
  const theme = useTheme();
  const empty = !userId;
  const accent: FrequencyColors = userId
    ? theme.colors.frequency[toneFor(userId)]
    : theme.colors.frequency.daily;

  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: empty ? theme.colors.white : accent.tint,
        borderWidth: empty ? 1.5 : override ? 1.5 : 0,
        borderColor: empty
          ? theme.colors.borderStrong
          : override
            ? theme.colors.primary
            : 'transparent',
        borderStyle: empty ? 'dashed' : 'solid',
      }}
    >
      {empty ? (
        <Ionicons
          name="people-outline"
          size={size === 28 ? 14 : 18}
          color={theme.colors.inkMuted}
        />
      ) : (
        <Text
          style={{
            fontFamily: theme.fonts.bodyBold,
            fontSize: size === 28 ? 12 : 16,
            color: accent.text,
          }}
          allowFontScaling
        >
          {assigneeInitial(name ?? '')}
        </Text>
      )}
    </View>
  );
}
