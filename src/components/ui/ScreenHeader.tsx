import type { ReactNode } from 'react';
import { Text, View, type StyleProp, type ViewStyle } from 'react-native';

import { useTheme } from '@/design';

type Props = {
  title: string;
  eyebrow?: string;
  right?: ReactNode;
  style?: StyleProp<ViewStyle>;
};

/**
 * Shared page header. Trailing action aligns to the title row (not the
 * eyebrow+title stack), so gear/add icons sit on the title centerline.
 */
export function ScreenHeader({ title, eyebrow, right, style }: Props) {
  const theme = useTheme();

  return (
    <View style={[{ gap: 2, width: '100%' }, style]}>
      {eyebrow ? (
        <Text
          style={{
            fontFamily: theme.fonts.label,
            fontSize: theme.typography.label.fontSize,
            lineHeight: theme.typography.label.lineHeight,
            color: theme.colors.inkSubtle,
            textTransform: 'uppercase',
            letterSpacing: 0.6,
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
              fontSize: theme.typography.title.fontSize,
              lineHeight: theme.typography.title.lineHeight,
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
