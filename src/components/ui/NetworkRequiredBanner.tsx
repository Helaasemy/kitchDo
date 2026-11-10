import { Text, View } from 'react-native';

import { useTheme } from '@/design';
import { useT } from '@/i18n';

/** Shown on template/category/schedule editors that require a live connection. */
export function NetworkRequiredBanner({ visible }: { visible?: boolean }) {
  const t = useT();
  const theme = useTheme();
  if (visible === false) return null;

  return (
    <View
      style={{
        paddingVertical: theme.space.sm,
        paddingHorizontal: theme.space.md,
        borderRadius: theme.radii.sm,
        backgroundColor: theme.colors.sand,
        borderWidth: 1,
        borderColor: theme.colors.border,
      }}
    >
      <Text
        style={{
          fontFamily: theme.fonts.body,
          fontSize: theme.typography.caption.fontSize,
          color: theme.colors.inkMuted,
        }}
        allowFontScaling
      >
        {t().sync.networkRequired}
      </Text>
    </View>
  );
}
