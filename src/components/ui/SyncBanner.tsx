import { Pressable, Text, View } from 'react-native';

import { useTheme } from '@/design';
import { useSync } from '@/lib/sync';
import { useT } from '@/i18n';

export function SyncBanner() {
  const t = useT();
  const theme = useTheme();
  const { status, retry } = useSync();
  const copy = t().sync;

  if (status.kind === 'idle' && status.failedCount === 0) return null;

  const label =
    status.failedCount > 0 && (status.kind === 'idle' || status.kind === 'error')
      ? copy.failedChanges.replace('{count}', String(status.failedCount))
      : status.kind === 'offline'
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
        minHeight: 44,
        paddingVertical: theme.space.sm,
        paddingHorizontal: theme.space.lg,
        borderRadius: theme.radii.xl,
        backgroundColor:
          status.kind === 'offline' || status.kind === 'error'
            ? theme.colors.sand
            : theme.colors.card,
        borderWidth: 0.5,
        borderColor: theme.colors.border,
      }}
      accessibilityRole="summary"
    >
      <Text
        style={{
          flex: 1,
          fontFamily: theme.fonts.bodyMedium,
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
          style={{ minHeight: 44, justifyContent: 'center', paddingHorizontal: 8 }}
        >
          <Text
            style={{
              fontFamily: theme.fonts.bodyExtraBold,
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
