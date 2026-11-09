import { useCallback, useRef, useState } from 'react';
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
  groupByFrequencyAndTemplate,
  periodEnd,
  RecurringGroupCard,
  useRecurringTasks,
  type TaskFrequency,
} from '@/features/recurring';
import { cancelRun, listTodayRuns, type RunSummary } from '@/features/runs';
import { getDeviceTimeZone } from '@/lib/dates';
import { useSync } from '@/lib/sync';
import { t, tone } from '@/i18n';

function openRun(runId: string) {
  router.push(`/(app)/runs/${runId}`);
}

function runSubtitle(run: RunSummary, lead: string = run.dueLabel): string {
  return [
    lead,
    `${run.progressDone}/${run.progressTotal}`,
    run.blocked ? `${run.blocked} blocked` : null,
  ]
    .filter(Boolean)
    .join(' · ');
}

function TodayRunRow({
  run,
  subtitle,
  theme,
  onRequestDelete,
}: {
  run: RunSummary;
  subtitle: string;
  theme: AppTheme;
  onRequestDelete: (run: RunSummary) => void;
}) {
  const copy = t().today;

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
      />
    </Swipeable>
  );
}

function SectionHeading({
  theme,
  label,
  hint,
}: {
  theme: AppTheme;
  label: string;
  hint?: string;
}) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: theme.space.sm }}>
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
        {label}
      </Text>
      {hint ? (
        <Text
          style={{
            fontFamily: theme.fonts.body,
            fontSize: theme.typography.caption.fontSize,
            color: theme.colors.inkSubtle,
          }}
          allowFontScaling
        >
          {hint}
        </Text>
      ) : null}
    </View>
  );
}

function periodHint(frequency: TaskFrequency): string | undefined {
  if (frequency === 'daily') return undefined;
  const end = periodEnd(frequency, DateTime.now().setZone(getDeviceTimeZone()));
  return t().recurring.untilDate.replace(
    '{date}',
    end.toFormat(frequency === 'weekly' ? 'ccc d LLL' : 'd LLL'),
  );
}

export default function TodayScreen() {
  const theme = useTheme();
  const { kitchenMode, onboarding, user, kitchenId } = useAuth();
  const userId = user?.id;
  const { refresh } = useSync();
  const copy = t().today;
  const recurringCopy = t().recurring;
  const title = tone(kitchenMode, copy.titleHome, copy.titleBusiness);

  const [due, setDue] = useState<RunSummary[]>([]);
  const [earlier, setEarlier] = useState<RunSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const hasLoaded = useRef(false);
  const recurring = useRecurringTasks(userId, kitchenId);
  const reloadRecurring = recurring.reload;

  const load = useCallback(async () => {
    if (!userId || !kitchenId) {
      setDue([]);
      setEarlier([]);
      setLoading(false);
      return;
    }
    // Only blank the list on the first load — refresh in place otherwise so
    // sync does not look like a continuous re-render.
    if (!hasLoaded.current) setLoading(true);
    try {
      await reloadRecurring();
      await refresh();
      const result = await listTodayRuns(userId, kitchenId);
      setDue(result.due);
      setEarlier(result.earlierUnfinished);
      hasLoaded.current = true;
    } finally {
      setLoading(false);
    }
  }, [userId, kitchenId, refresh, reloadRecurring]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  const groups = groupByFrequencyAndTemplate(recurring.tasks);
  const periods: { frequency: TaskFrequency; label: string }[] = [
    { frequency: 'daily', label: recurringCopy.periodToday },
    { frequency: 'weekly', label: recurringCopy.periodWeek },
    { frequency: 'monthly', label: recurringCopy.periodMonth },
  ];
  const empty =
    !loading && recurring.tasks.length === 0 && due.length === 0 && earlier.length === 0;

  const onRequestDelete = (run: RunSummary) => {
    Alert.alert(copy.deleteRunTitle, copy.deleteRunBody, [
      { text: t().common.cancel, style: 'cancel' },
      {
        text: copy.deleteRun,
        style: 'destructive',
        onPress: () => {
          if (!userId || !kitchenId) return;
          void (async () => {
            try {
              await cancelRun({ userId, kitchenId, runId: run.id });
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
  };

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
              gap: theme.space.xl,
              paddingBottom: theme.space.xxl,
              alignItems: 'stretch',
            }}
          >
            {due.length > 0 ? (
              <View style={{ gap: theme.space.sm }}>
                <SectionHeading theme={theme} label={copy.checklistsTitle} />
                {due.map((run) => (
                  <TodayRunRow
                    key={run.id}
                    run={run}
                    theme={theme}
                    onRequestDelete={onRequestDelete}
                    subtitle={runSubtitle(run)}
                  />
                ))}
              </View>
            ) : null}

            {periods.map(({ frequency, label }) =>
              groups[frequency].length > 0 ? (
                <View key={frequency} style={{ gap: theme.space.md }}>
                  <SectionHeading
                    theme={theme}
                    label={label}
                    hint={periodHint(frequency)}
                  />
                  {groups[frequency].map((group) => (
                    <RecurringGroupCard
                      key={group.templateId}
                      title={group.templateTitle}
                      tasks={group.tasks}
                      doneCount={group.doneCount}
                      onOpenTemplate={() =>
                        router.push(`/(app)/(tabs)/templates/${group.templateId}/hub`)
                      }
                      onToggle={(task) => void recurring.toggle(task)}
                    />
                  ))}
                </View>
              ) : null,
            )}

            {earlier.length > 0 ? (
              <View style={{ gap: theme.space.sm }}>
                <SectionHeading theme={theme} label={copy.earlierUnfinished} />
                {earlier.map((run) => (
                  <TodayRunRow
                    key={run.id}
                    run={run}
                    theme={theme}
                    onRequestDelete={onRequestDelete}
                    subtitle={runSubtitle(run, run.localDate)}
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
