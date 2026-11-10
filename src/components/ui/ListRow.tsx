import type { ReactNode } from 'react';
import {
  Pressable,
  Text,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';

import { useTheme } from '@/design';
import type { DueUrgency } from '@/lib/dates';

type Props = {
  title: string;
  subtitle?: string;
  /** Leading slot, e.g. an icon square. */
  left?: ReactNode;
  right?: ReactNode;
  onPress?: () => void;
  onLongPress?: () => void;
  /** @deprecated Prefer `dueUrgency` */
  urgency?: boolean;
  dueUrgency?: DueUrgency;
  style?: StyleProp<ViewStyle>;
};

/** Paper card row; pressable rows get a chevron unless `right` is given. */
export function ListRow({
  title,
  subtitle,
  left,
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
  const pressable = Boolean(onPress || onLongPress);

  const content = (pressed: boolean) => (
    <View
      style={[
        {
          minHeight: 64,
          width: '100%',
          paddingVertical: theme.space.md,
          paddingHorizontal: theme.space.xl - 4,
          borderRadius: theme.radii.xl,
          borderWidth: 0.5,
          borderColor: theme.colors.border,
          backgroundColor:
            tone === 'overdue'
              ? theme.colors.alertTint
              : pressed
                ? theme.colors.sand
                : theme.colors.card,
          boxShadow: theme.shadows.soft,
          flexDirection: 'row',
          alignItems: 'center',
          gap: theme.space.md,
        },
        style,
      ]}
    >
      {left}
      <View style={{ flex: 1, minWidth: 0, justifyContent: 'center', gap: 2 }}>
        <Text
          style={{
            fontFamily: theme.fonts.bodyBold,
            fontSize: theme.typography.body.fontSize,
            lineHeight: theme.typography.body.lineHeight,
            color: theme.colors.ink,
          }}
          numberOfLines={2}
          allowFontScaling
        >
          {title}
        </Text>
        {subtitle ? (
          <Text
            style={{
              fontFamily: accent ? theme.fonts.bodySemiBold : theme.fonts.bodyMedium,
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
      ) : pressable ? (
        <Ionicons name="chevron-forward" size={16} color={theme.colors.inkSubtle} />
      ) : null}
    </View>
  );

  if (!pressable) return content(false);

  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      onLongPress={onLongPress}
      delayLongPress={350}
    >
      {({ pressed }) => content(pressed)}
    </Pressable>
  );
}
