import type { ReactNode } from 'react';
import { Text, View, type StyleProp, type ViewStyle } from 'react-native';

import { useTheme } from '@/design';

type Props = {
  title: string;
  eyebrow?: string;
  right?: ReactNode;
  /** `display` is the large italic serif used on tab home pages. */
  size?: 'title' | 'display';
  style?: StyleProp<ViewStyle>;
};

/**
 * Shared page header. Trailing action aligns to the title row (not the
 * eyebrow+title stack), so gear/add icons sit on the title centerline.
 */
export function ScreenHeader({ title, eyebrow, right, size = 'title', style }: Props) {
  const theme = useTheme();
  const titleType = size === 'display' ? theme.typography.display : theme.typography.title;

  return (
    <View style={[{ gap: theme.space.xs, width: '100%' }, style]}>
      {eyebrow ? (
        <Text
          style={{
            fontFamily: theme.fonts.label,
            fontSize: theme.typography.chip.fontSize,
            lineHeight: theme.typography.chip.lineHeight,
            color: theme.colors.inkMuted,
            textTransform: 'uppercase',
            letterSpacing: 1.6,
            paddingRight: right ? 52 : 0,
          }}
          numberOfLines={1}
          allowFontScaling
        >
          {eyebrow}
        </Text>
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
