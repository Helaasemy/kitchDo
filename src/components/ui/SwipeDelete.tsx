import type { ReactNode } from 'react';
import { Pressable, Text, View } from 'react-native';
import Swipeable, {
  type SwipeableMethods,
} from 'react-native-gesture-handler/ReanimatedSwipeable';

import { useTheme } from '@/design';
import { useI18n } from '@/i18n';

const ACTION_WIDTH = 96;

type Props = {
  enabled: boolean;
  label: string;
  onDelete: () => void;
  archiveLabel?: string;
  onArchive?: () => void;
  children: ReactNode;
  radius?: number;
};

export function SwipeDelete({
  enabled,
  label,
  onDelete,
  archiveLabel,
  onArchive,
  children,
  radius,
}: Props) {
  const theme = useTheme();
  const { direction } = useI18n();
  const rtl = direction === 'rtl';
  const showArchive = Boolean(archiveLabel && onArchive);

  const renderActions = (
    _progress: unknown,
    _translation: unknown,
    methods: SwipeableMethods,
  ) => (
    <View style={{ flexDirection: rtl ? 'row-reverse' : 'row' }}>
      {showArchive ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={archiveLabel}
          onPress={() => {
            methods.close();
            onArchive?.();
          }}
          style={{
            width: ACTION_WIDTH,
            backgroundColor: theme.colors.sand,
            justifyContent: 'center',
            alignItems: 'center',
            paddingHorizontal: theme.space.sm,
          }}
        >
          <Text
            style={{
              fontFamily: theme.fonts.bodyBold,
              fontSize: theme.typography.bodySmall.fontSize,
              color: theme.colors.ink,
              textAlign: 'center',
            }}
            allowFontScaling
          >
            {archiveLabel}
          </Text>
        </Pressable>
      ) : null}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={label}
        onPress={() => {
          methods.close();
          onDelete();
        }}
        style={{
          width: ACTION_WIDTH,
          backgroundColor: theme.colors.coral,
          justifyContent: 'center',
          alignItems: 'center',
          paddingHorizontal: theme.space.sm,
        }}
      >
        <Text
          style={{
            fontFamily: theme.fonts.bodyBold,
            fontSize: theme.typography.bodySmall.fontSize,
            color: theme.colors.onCoral,
            textAlign: 'center',
          }}
          allowFontScaling
        >
          {label}
        </Text>
      </Pressable>
    </View>
  );

  if (!enabled) return children;

  return (
    <Swipeable
      friction={2}
      overshootFriction={8}
      overshootLeft={false}
      overshootRight={false}
      renderRightActions={rtl ? undefined : renderActions}
      renderLeftActions={rtl ? renderActions : undefined}
      containerStyle={
        radius != null
          ? { borderRadius: radius, overflow: 'hidden' }
          : { overflow: 'hidden' }
      }
    >
      {children}
    </Swipeable>
  );
}
