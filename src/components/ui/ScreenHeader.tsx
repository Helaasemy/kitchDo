import type { ReactNode } from 'react';
import { Pressable, Text, View, type StyleProp, type ViewStyle } from 'react-native';

import { useTheme } from '@/design';

type Props = {
  title: string;
  eyebrow?: string;
  onEyebrowPress?: () => void;
  right?: ReactNode;
  /** `display` is the large italic serif used on tab home pages. */
  size?: 'title' | 'display';
  style?: StyleProp<ViewStyle>;
};

/**
 * Shared page header. Trailing action aligns to the title row (not the
 * eyebrow+title stack), so gear/add icons sit on the title centerline.
 */
export function ScreenHeader({
  title,
  eyebrow,
  onEyebrowPress,
  right,
  size = 'title',
  style,
}: Props) {
  const theme = useTheme();
  const titleType = size === 'display' ? theme.typography.display : theme.typography.title;
  const eyebrowStyle = {
    fontFamily: theme.fonts.label,
    fontSize: theme.typography.chip.fontSize,
    lineHeight: theme.typography.chip.lineHeight,
    color: theme.colors.inkMuted,
    textTransform: 'uppercase' as const,
    letterSpacing: 1.6,
    paddingRight: right ? 52 : 0,
  };

  return (
    <View style={[{ gap: theme.space.xs, width: '100%' }, style]}>
      {eyebrow ? (
        onEyebrowPress ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={eyebrow}
            onPress={onEyebrowPress}
            hitSlop={8}
          >
            <Text style={eyebrowStyle} numberOfLines={1} allowFontScaling>
              {eyebrow}
            </Text>
          </Pressable>
        ) : (
          <Text style={eyebrowStyle} numberOfLines={1} allowFontScaling>
            {eyebrow}
          </Text>
        )
      ) : null}

      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: theme.space.md,
          minHeight: 44,
        }}
      >
        <View
          style={{
            flex: 1,
            minWidth: 0,
            minHeight: 44,
            justifyContent: 'center',
          }}
        >
          <Text
            style={{
              fontFamily: theme.fonts.display,
              fontSize: titleType.fontSize,
              lineHeight: titleType.lineHeight,
              letterSpacing: -0.4,
              color: theme.colors.ink,
            }}
            numberOfLines={2}
            allowFontScaling
          >
            {title}
          </Text>
        </View>
        {right ? (
          <View
            style={{
              height: 44,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            {right}
          </View>
        ) : null}
      </View>
    </View>
  );
}
