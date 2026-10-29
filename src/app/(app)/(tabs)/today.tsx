import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  Text,
  View,
} from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import Swipeable, {
  type SwipeableMethods,
} from 'react-native-gesture-handler/ReanimatedSwipeable';
import { DateTime } from 'luxon';

import {
  DueCountdownRing,
  EmptyState,
  IconButton,
  ListRow,
  Screen,
  ScreenHeader,
  SyncBanner,
} from '@/components/ui';
import { useTheme, type AppTheme } from '@/design';
import { useAuth } from '@/features/auth';
import {
  cancelRun,
  listTodayRuns,
  type RunSummary,
} from '@/features/runs';
import { getDueCountdown } from '@/lib/dates';
import { useSync } from '@/lib/sync';
import { t, tone } from '@/i18n';

function openRun(runId: string) {
  router.push(`/(app)/runs/${runId}`);
}

function countdownFor(run: RunSummary, now: DateTime) {
  const copy = t().today;
  return getDueCountdown(run.dueAt, {
    now,
    finished: run.state === 'finished' || run.state === 'cancelled',
    dueIn: copy.dueIn,
    overdueBy: copy.overdueBy,
    scheduledFor: run.scheduledFor,
  });
}

function TodayRunRow({
  run,
  subtitle,
  now,
  theme,
  onRequestDelete,
}: {
  run: RunSummary;
  subtitle: string;
  now: DateTime;
  theme: AppTheme;
  onRequestDelete: (run: RunSummary) => void;
}) {
  const copy = t().today;
  const countdown = countdownFor(run, now);

  const renderRightActions = (
    _progress: unknown,
    _translation: unknown,
    methods: SwipeableMethods,
  ) => (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={copy.deleteRun}
      onPress={() => {
        methods.close();
        onRequestDelete(run);
      }}
      style={{
        backgroundColor: theme.colors.coral,
        justifyContent: 'center',
        alignItems: 'center',
        paddingHorizontal: theme.space.lg,
        marginLeft: theme.space.sm,
        borderRadius: theme.radii.sm,
        minWidth: 88,
      }}
    >
      <Text
        style={{
          fontFamily: theme.fonts.bodyMedium,
          fontSize: theme.typography.body.fontSize,
          color: theme.colors.white,
        }}
        allowFontScaling
      >
        {copy.deleteRun}
      </Text>
    </Pressable>
  );

  return (
    <Swipeable
      renderRightActions={renderRightActions}
      overshootRight={false}
      friction={2}
    >
      <ListRow
        title={run.title}
        subtitle={subtitle}
        onPress={() => openRun(run.id)}
        right={
          countdown.shortLabel ? (
            <DueCountdownRing
              shortLabel={countdown.shortLabel}
              progress={countdown.progress}
              urgency={countdown.urgency}
            />
          ) : null
        }
      />
    </Swipeable>
  );
}

export default function TodayScreen() {
  const theme = useTheme();
  const { kitchenMode, onboarding, user, kitchenId } = useAuth();
  const { refresh } = useSync();
  const copy = t().today;
  const title = tone(kitchenMode, copy.titleHome, copy.titleBusiness);

  const [due, setDue] = useState<RunSummary[]>([]);
  const [earlier, setEarlier] = useState<RunSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [now, setNow] = useState(() => DateTime.now());

  const load = useCallback(async () => {
    if (!user?.id || !kitchenId) {
      setDue([]);
      setEarlier([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      await refresh();
      const result = await listTodayRuns(user.id, kitchenId);
      setDue(result.due);
      setEarlier(result.earlierUnfinished);
      setNow(DateTime.now());
    } finally {
      setLoading(false);
    }
  }, [user?.id, kitchenId, refresh]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  useEffect(() => {
    const id = setInterval(() => setNow(DateTime.now()), 30_000);
    return () => clearInterval(id);
  }, []);

  const empty = !loading && due.length === 0 && earlier.length === 0;

  const onRequestDelete = useCallback(
    (run: RunSummary) => {
      Alert.alert(copy.deleteRunTitle, copy.deleteRunBody, [
        { text: t().common.cancel, style: 'cancel' },
        {
          text: copy.deleteRun,
          style: 'destructive',
          onPress: () => {
            if (!user?.id || !kitchenId) return;
            void (async () => {
              try {
                await cancelRun({
                  userId: user.id,
                  kitchenId,
                  runId: run.id,
                });
                await load();
              } catch (e) {
                Alert.alert(
                  t().common.errorGeneric,
                  e instanceof Error ? e.message : undefined,
                );
              }
            })();
          },
        },
      ]);
    },
    [copy.deleteRun, copy.deleteRunBody, copy.deleteRunTitle, kitchenId, load, user?.id],
  );

  return (
    <Screen>
      <View style={{ gap: theme.space.md, flex: 1 }}>
        <ScreenHeader
          eyebrow={onboarding?.kitchenName || undefined}
          title={title}
          right={
            <IconButton
              name="settings-outline"
              accessibilityLabel={t().settings.title}
              onPress={() => router.push('/(app)/settings')}
            />
          }
        />

        <SyncBanner />

        {loading ? (
          <View style={{ paddingTop: theme.space.xl, alignItems: 'center' }}>
            <ActivityIndicator color={theme.colors.primary} />
          </View>
        ) : empty ? (
          <EmptyState
            title={tone(kitchenMode, copy.emptyTitleHome, copy.emptyTitleBusiness)}
            body={tone(kitchenMode, copy.emptyBodyHome, copy.emptyBodyBusiness)}
            actionLabel={copy.emptyAction}
            onAction={() => router.replace('/(app)/(tabs)/templates')}
          />
        ) : (
          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{
              gap: theme.space.md,
              paddingBottom: theme.space.xxl,
              alignItems: 'stretch',
            }}
          >
            {due.length > 0 ? (
              <View style={{ gap: theme.space.sm }}>
                {due.map((run) => (
                  <TodayRunRow
                    key={run.id}
                    run={run}
                    now={now}
                    theme={theme}
                    onRequestDelete={onRequestDelete}
                    subtitle={`${run.dueLabel} · ${run.progressDone}/${run.progressTotal}${
                      run.blocked ? ` · ${run.blocked} blocked` : ''
                    }`}
                  />
                ))}
              </View>
            ) : null}

            {earlier.length > 0 ? (
              <View style={{ gap: theme.space.sm }}>
                <Text
                  style={{
                    fontFamily: theme.fonts.label,
                    fontSize: theme.typography.label.fontSize,
                    lineHeight: theme.typography.label.lineHeight,
                    color: theme.colors.inkSubtle,
                    textTransform: 'uppercase',
                    letterSpacing: 0.5,
                  }}
                  allowFontScaling
                >
                  {copy.earlierUnfinished}
                </Text>
                {earlier.map((run) => (
                  <TodayRunRow
                    key={run.id}
                    run={run}
                    now={now}
                    theme={theme}
                    onRequestDelete={onRequestDelete}
                    subtitle={`${run.localDate} · ${run.progressDone}/${run.progressTotal}`}
                  />
                ))}
              </View>
            ) : null}
          </ScrollView>
        )}
      </View>
    </Screen>
  );
}
