import type { ReactNode } from 'react';
import {
  Pressable,
  Text,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';

import { useTheme } from '@/design';
import type { DueUrgency } from '@/lib/dates';

type Props = {
  title: string;
  subtitle?: string;
  right?: ReactNode;
  onPress?: () => void;
  onLongPress?: () => void;
  /** @deprecated Prefer `dueUrgency` */
  urgency?: boolean;
  dueUrgency?: DueUrgency;
  style?: StyleProp<ViewStyle>;
};

export function ListRow({
  title,
  subtitle,
  right,
  onPress,
  onLongPress,
  urgency = false,
  dueUrgency,
  style,
}: Props) {
  const theme = useTheme();
  const tone: DueUrgency =
    dueUrgency ?? (urgency ? 'overdue' : 'none');
  const accent =
    tone === 'overdue'
      ? theme.colors.coral
      : tone === 'soon'
        ? theme.colors.primary
        : null;

  const content = (
    <View
      style={[
        {
          minHeight: 52,
          width: '100%',
          paddingVertical: theme.space.md,
          paddingHorizontal: theme.space.md,
          borderRadius: theme.radii.sm,
          borderWidth: 1,
          borderColor: accent ?? theme.colors.border,
          backgroundColor: theme.colors.white,
          flexDirection: 'row',
          alignItems: 'center',
          gap: theme.space.md,
        },
        style,
      ]}
    >
      <View style={{ flex: 1, minWidth: 0, justifyContent: 'center', gap: 2 }}>
        <Text
          style={{
            fontFamily: theme.fonts.bodyMedium,
            fontSize: theme.typography.body.fontSize,
            lineHeight: theme.typography.body.lineHeight,
            color: theme.colors.ink,
          }}
          numberOfLines={1}
          allowFontScaling
        >
          {title}
        </Text>
        {subtitle ? (
          <Text
            style={{
              fontFamily: theme.fonts.body,
              fontSize: theme.typography.caption.fontSize,
              lineHeight: theme.typography.caption.lineHeight,
              color: accent ?? theme.colors.inkMuted,
            }}
            numberOfLines={2}
            allowFontScaling
          >
            {subtitle}
          </Text>
        ) : null}
      </View>
      {right ? (
        <View style={{ alignItems: 'center', justifyContent: 'center' }}>
          {right}
        </View>
      ) : null}
    </View>
  );

  if (!onPress && !onLongPress) return content;

  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      onLongPress={onLongPress}
      delayLongPress={350}
      style={({ pressed }) => ({ opacity: pressed ? 0.85 : 1 })}
    >
      {content}
    </Pressable>
  );
}
