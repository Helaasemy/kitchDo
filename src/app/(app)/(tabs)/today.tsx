import { useCallback, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  Text,
  View,
} from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { router, useFocusEffect } from 'expo-router';
import Swipeable, {
  type SwipeableMethods,
} from 'react-native-gesture-handler/ReanimatedSwipeable';
import { DateTime } from 'luxon';

import {
  EmptyState,
  ErrorText,
  IconButton,
  Screen,
  ScreenHeader,
  SectionChip,
  SyncBanner,
} from '@/components/ui';
import { useTheme, type AppTheme } from '@/design';
import { useAuth } from '@/features/auth';
import {
  countDone,
  groupByFrequencyAndTemplate,
  periodEnd,
  RecurringGroupCard,
  TASK_FREQUENCIES,
  useRecurringTasks,
  type RecurringTaskState,
  type TaskFrequency,
} from '@/features/recurring';
import { cancelRun, listTodayRuns, type RunSummary } from '@/features/runs';
import { getDeviceTimeZone } from '@/lib/dates';
import { useSync } from '@/lib/sync';
import { t, useT, tone } from '@/i18n';

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

function RunCard({
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
  const t = useT();
  const copy = t().today;
  const alert = run.urgency || run.blocked > 0;

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
        borderRadius: theme.radii.xxl,
        minWidth: 88,
      }}
    >
      <Text
        style={{
          fontFamily: theme.fonts.bodyBold,
          fontSize: theme.typography.body.fontSize,
          color: '#FFFFFF',
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
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${run.title}, ${subtitle}`}
        onPress={() => openRun(run.id)}
        style={({ pressed }) => ({
          minHeight: 64,
          flexDirection: 'row',
          alignItems: 'center',
          gap: theme.space.lg,
          padding: theme.space.lg,
          borderRadius: theme.radii.xxl,
          backgroundColor: alert ? theme.colors.alertTint : theme.colors.white,
          boxShadow: theme.shadows.raised,
          opacity: pressed ? 0.85 : 1,
        })}
      >
        <View
          style={{
            width: 48,
            height: 48,
            borderRadius: theme.radii.xl,
            backgroundColor: alert ? theme.colors.coral : theme.colors.primaryTint,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Ionicons
            name={alert ? 'alert-circle' : 'play'}
            size={22}
            color={alert ? '#FFFFFF' : theme.colors.primary}
          />
        </View>
        <View style={{ flex: 1, gap: 2 }}>
          <Text
            style={{
              fontFamily: theme.fonts.bodyExtraBold,
              fontSize: theme.typography.body.fontSize,
              lineHeight: 22,
              color: theme.colors.ink,
            }}
            numberOfLines={2}
            allowFontScaling
          >
            {run.title}
          </Text>
          <Text
            style={{
              fontFamily: alert ? theme.fonts.bodySemiBold : theme.fonts.bodyMedium,
              fontSize: theme.typography.caption.fontSize,
              lineHeight: theme.typography.caption.lineHeight,
              color: alert ? theme.colors.coral : theme.colors.inkMuted,
            }}
            allowFontScaling
          >
            {subtitle}
          </Text>
        </View>
      </Pressable>
    </Swipeable>
  );
}

function SummaryTiles({
  theme,
  tasks,
}: {
  theme: AppTheme;
  tasks: RecurringTaskState[];
}) {
  const t = useT();
  const copy = t().today;
  const labels: Record<TaskFrequency, string> = {
    daily: copy.summaryToday,
    weekly: copy.summaryWeek,
    monthly: copy.summaryMonth,
  };

  return (
    <View style={{ flexDirection: 'row', gap: theme.space.md }}>
      {TASK_FREQUENCIES.map((frequency) => {
        const accent = theme.colors.frequency[frequency];
        const ofFrequency = tasks.filter((task) => task.frequency === frequency);
        const done = countDone(ofFrequency);
        const value = ofFrequency.length ? `${done}/${ofFrequency.length}` : '–';
        return (
          <View
            key={frequency}
            accessible
            accessibilityLabel={copy.summaryA11y
              .replace('{period}', labels[frequency])
              .replace('{done}', String(done))
              .replace('{total}', String(ofFrequency.length))}
            style={{
              flex: 1,
              gap: theme.space.xs,
              padding: theme.space.lg,
              borderRadius: 24,
              backgroundColor: accent.tint,
            }}
          >
            <Text
              style={{
                fontFamily: theme.fonts.label,
                fontSize: theme.typography.chip.fontSize,
                lineHeight: theme.typography.chip.lineHeight,
                textTransform: 'uppercase',
                color: accent.text,
              }}
              allowFontScaling
            >
              {labels[frequency]}
            </Text>
            <Text
              style={{
                fontFamily: theme.fonts.bodyExtraBold,
                fontSize: 20,
                lineHeight: 26,
                color: theme.colors.ink,
              }}
              allowFontScaling
            >
              {value}
            </Text>
          </View>
        );
      })}
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

function dateLine(tasks: RecurringTaskState[]): string {
  const copy = t().today;
  const date = DateTime.now().setZone(getDeviceTimeZone()).toFormat('cccc d LLLL');
  const daily = tasks.filter((task) => task.frequency === 'daily');
  if (daily.length === 0) return date;
  const left = daily.length - countDone(daily);
  if (left === 0) return copy.allDoneToday.replace('{date}', date);
  if (left === 1) return copy.leftTodayOne.replace('{date}', date);
  return copy.leftToday.replace('{date}', date).replace('{count}', String(left));
}

export default function TodayScreen() {
  const t = useT();
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
  const periodLabels: Record<TaskFrequency, string> = {
    daily: recurringCopy.periodToday,
    weekly: recurringCopy.periodWeek,
    monthly: recurringCopy.periodMonth,
  };
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
      <View style={{ gap: theme.space.lg, flex: 1 }}>
        <View style={{ gap: theme.space.xs }}>
          <ScreenHeader
            size="display"
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
          <Text
            style={{
              fontFamily: theme.fonts.bodyMedium,
              fontSize: 15,
              lineHeight: 20,
              color: theme.colors.inkMuted,
            }}
            allowFontScaling
          >
            {dateLine(recurring.tasks)}
          </Text>
        </View>

        <SyncBanner />
        <ErrorText message={recurring.error} />

        {loading ? (
          <View style={{ paddingTop: theme.space.xl, alignItems: 'center' }}>
            <ActivityIndicator color={theme.colors.primary} />
          </View>
        ) : empty && !recurring.error ? (
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
              gap: theme.space.xxl + theme.space.sm,
              paddingTop: theme.space.sm,
              paddingBottom: theme.space.xxxl,
              alignItems: 'stretch',
            }}
          >
            {recurring.tasks.length > 0 ? (
              <SummaryTiles theme={theme} tasks={recurring.tasks} />
            ) : null}

            {due.length > 0 ? (
              <View style={{ gap: theme.space.lg }}>
                <SectionChip
                  label={copy.checklistsTitle}
                  chipTone={{ background: theme.colors.primary, text: '#FFFFFF' }}
                />
                <View style={{ gap: theme.space.md }}>
                  {due.map((run) => (
                    <RunCard
                      key={run.id}
                      run={run}
                      theme={theme}
                      onRequestDelete={onRequestDelete}
                      subtitle={runSubtitle(run)}
                    />
                  ))}
                </View>
              </View>
            ) : null}

            {TASK_FREQUENCIES.map((frequency) => {
              const accent = theme.colors.frequency[frequency];
              return groups[frequency].length > 0 ? (
                <View key={frequency} style={{ gap: theme.space.lg }}>
                  <SectionChip
                    label={periodLabels[frequency]}
                    hint={periodHint(frequency)}
                    chipTone={{
                      background: accent.tint,
                      text: theme.colors.ink,
                      dot: accent.base,
                    }}
                  />
                  {groups[frequency].map((group) => (
                    <RecurringGroupCard
                      key={group.templateId}
                      title={group.templateTitle}
                      frequency={frequency}
                      tasks={group.tasks}
                      doneCount={group.doneCount}
                      onOpenTemplate={() =>
                        router.push(`/(app)/(tabs)/templates/${group.templateId}/hub`)
                      }
                      onToggle={(task) => void recurring.toggle(task)}
                    />
                  ))}
                </View>
              ) : null;
            })}

            {earlier.length > 0 ? (
              <View style={{ gap: theme.space.lg }}>
                <SectionChip
                  label={copy.earlierUnfinished}
                  chipTone={{ background: theme.colors.sand, text: theme.colors.ink }}
                />
                <View style={{ gap: theme.space.md }}>
                  {earlier.map((run) => (
                    <RunCard
                      key={run.id}
                      run={run}
                      theme={theme}
                      onRequestDelete={onRequestDelete}
                      subtitle={runSubtitle(run, run.localDate)}
                    />
                  ))}
                </View>
              </View>
            ) : null}
          </ScrollView>
        )}
      </View>
    </Screen>
  );
}
