import { Pressable, Text, View } from 'react-native';

import { useTheme } from '@/design';
import { useSync } from '@/lib/sync';
import { t } from '@/i18n';

export function SyncBanner() {
  const theme = useTheme();
  const { status, retry } = useSync();
  const copy = t().sync;

  if (status.kind === 'idle') return null;

  const label =
    status.kind === 'offline'
      ? copy.offline
      : status.kind === 'syncing'
        ? copy.syncing
        : status.kind === 'changes_waiting'
          ? copy.changesWaiting.replace(
              '{count}',
              String(status.pendingCount),
            )
          : copy.error;

  const showRetry =
    status.kind === 'offline' ||
    status.kind === 'error' ||
    status.kind === 'changes_waiting';

  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: theme.space.sm,
        paddingVertical: theme.space.sm,
        paddingHorizontal: theme.space.md,
        borderRadius: theme.radii.sm,
        backgroundColor:
          status.kind === 'offline' || status.kind === 'error'
            ? theme.colors.sand
            : theme.colors.white,
        borderWidth: 1,
        borderColor: theme.colors.border,
      }}
      accessibilityRole="summary"
    >
      <Text
        style={{
          flex: 1,
          fontFamily: theme.fonts.body,
          fontSize: theme.typography.caption.fontSize,
          color: theme.colors.inkMuted,
        }}
        allowFontScaling
      >
        {label}
      </Text>
      {showRetry ? (
        <Pressable
          accessibilityRole="button"
          onPress={() => void retry()}
          hitSlop={8}
        >
          <Text
            style={{
              fontFamily: theme.fonts.bodySemiBold,
              color: theme.colors.primary,
              fontSize: theme.typography.caption.fontSize,
            }}
            allowFontScaling
          >
            {t().common.retry}
          </Text>
        </Pressable>
      ) : null}
    </View>
  );
}
