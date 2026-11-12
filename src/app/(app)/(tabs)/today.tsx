import { useCallback, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, Text, View } from 'react-native';
import * as Haptics from 'expo-haptics';
import { router, useFocusEffect } from 'expo-router';
import { DateTime } from 'luxon';

import {
  Chip,
  EmptyState,
  ErrorText,
  IconButton,
  Screen,
  ScreenHeader,
  SectionChip,
  SyncBanner,
} from '@/components/ui';
import { isAssignedToMe } from '@/features/assignment';
import { listKitchenMembers, type KitchenMember } from '@/features/membership';
import { useTheme, type AppTheme } from '@/design';
import { useAuth } from '@/features/auth';
import { KitchenSwitcher } from '@/features/membership/KitchenSwitcher';
import {
  countDone,
  groupByFrequencyAndTemplate,
  periodEnd,
  RecurringGroupCard,
  TASK_FREQUENCIES,
  TickNoteModal,
  TODAY_FREQUENCIES,
  useRecurringTasks,
  type RecurringTaskState,
  type RepeatFrequency,
  type TaskFrequency,
} from '@/features/recurring';
import { getDeviceTimeZone } from '@/lib/dates';
import { templateEditorHref } from '@/lib/navigation';
import { useSync } from '@/lib/sync';
import { t, useT, tone } from '@/i18n';

function SummaryTiles({
  theme,
  tasks,
  selected,
  onSelect,
}: {
  theme: AppTheme;
  tasks: RecurringTaskState[];
  selected: RepeatFrequency | null;
  onSelect: (frequency: RepeatFrequency | null) => void;
}) {
  const t = useT();
  const copy = t().today;
  const labels: Record<RepeatFrequency, string> = {
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
        const isSelected = selected === frequency;
        const dimmed = selected != null && !isSelected;
        return (
          <Pressable
            key={frequency}
            accessibilityRole="button"
            accessibilityState={{ selected: isSelected }}
            accessibilityLabel={copy.summaryA11y
              .replace('{period}', labels[frequency])
              .replace('{done}', String(done))
              .replace('{total}', String(ofFrequency.length))}
            accessibilityHint={
              isSelected
                ? copy.filterClearA11y
                : copy.filterShowA11y.replace('{period}', labels[frequency])
            }
            onPress={() => {
              void Haptics.selectionAsync();
              onSelect(isSelected ? null : frequency);
            }}
            style={({ pressed }) => ({
              flex: 1,
              minHeight: 64,
              gap: theme.space.xs,
              padding: theme.space.lg,
              borderRadius: 24,
              backgroundColor: isSelected ? theme.colors.ink : accent.tint,
              opacity: pressed ? 0.85 : dimmed ? 0.45 : 1,
            })}
          >
            <Text
              style={{
                fontFamily: theme.fonts.label,
                fontSize: theme.typography.chip.fontSize,
                lineHeight: theme.typography.chip.lineHeight,
                textTransform: 'uppercase',
                color: isSelected ? theme.colors.canvas : accent.text,
              }}
              numberOfLines={1}
              adjustsFontSizeToFit
              minimumFontScale={0.75}
              allowFontScaling
            >
              {labels[frequency]}
            </Text>
            <Text
              style={{
                fontFamily: theme.fonts.bodyExtraBold,
                fontSize: 20,
                lineHeight: 26,
                color: isSelected ? theme.colors.canvas : theme.colors.ink,
              }}
              allowFontScaling
            >
              {value}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

function periodHint(frequency: TaskFrequency): string | undefined {
  if (frequency === 'daily' || frequency === 'once') return undefined;
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
  const { kitchenMode, onboarding, user, kitchenId, canEditTemplates, refreshOnboarding } =
    useAuth();
  const [switcherOpen, setSwitcherOpen] = useState(false);
  const userId = user?.id;
  const { refresh } = useSync();
  const copy = t().today;
  const recurringCopy = t().recurring;
  const title = tone(kitchenMode, copy.titleHome, copy.titleBusiness);

  const [frequencyFilter, setFrequencyFilter] = useState<RepeatFrequency | null>(null);
  const [mineOnly, setMineOnly] = useState(false);
  const [blockTask, setBlockTask] = useState<RecurringTaskState | null>(null);
  const [blockNote, setBlockNote] = useState('');
  const [members, setMembers] = useState<KitchenMember[]>([]);
  const [loading, setLoading] = useState(true);
  const hasLoaded = useRef(false);
  const recurring = useRecurringTasks(userId, kitchenId);
  const reloadRecurring = recurring.reload;

  const load = useCallback(async () => {
    if (!userId || !kitchenId) {
      setLoading(false);
      return;
    }
    // Only blank the list on the first load — refresh in place otherwise so
    // sync does not look like a continuous re-render.
    if (!hasLoaded.current) setLoading(true);
    try {
      await refreshOnboarding();
      await reloadRecurring();
      await refresh();
      try {
        setMembers(await listKitchenMembers(kitchenId));
      } catch {
        setMembers([]);
      }
      hasLoaded.current = true;
    } finally {
      setLoading(false);
    }
  }, [userId, kitchenId, refresh, reloadRecurring, refreshOnboarding]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  const memberNames = Object.fromEntries(
    members.map((member) => [member.userId, member.displayName]),
  );
  const visibleTasks =
    mineOnly && userId
      ? recurring.tasks.filter((task) => isAssignedToMe(task.assigneeUserId, userId))
      : recurring.tasks;
  const groups = groupByFrequencyAndTemplate(visibleTasks);
  const periodLabels: Record<TaskFrequency, string> = {
    daily: recurringCopy.periodToday,
    weekly: recurringCopy.periodWeek,
    monthly: recurringCopy.periodMonth,
    once: recurringCopy.once,
  };
  const empty = !loading && recurring.tasks.length === 0;
  const emptyMine = !loading && mineOnly && visibleTasks.length === 0 && !empty;

  return (
    <Screen>
      <View style={{ gap: theme.space.lg, flex: 1 }}>
        <View style={{ gap: theme.space.xs }}>
          <ScreenHeader
            size="display"
            eyebrow={onboarding?.kitchenName || undefined}
            onEyebrowPress={() => setSwitcherOpen(true)}
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
            {dateLine(visibleTasks)}
          </Text>
        </View>

        <View style={{ flexDirection: 'row', gap: theme.space.sm }}>
          <Chip
            label={copy.filterAll}
            selected={!mineOnly}
            onPress={() => setMineOnly(false)}
          />
          <Chip
            label={copy.mine}
            selected={mineOnly}
            onPress={() => setMineOnly(true)}
            accessibilityHint={mineOnly ? copy.mineClearA11y : copy.mineA11y}
          />
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
        ) : emptyMine && !recurring.error ? (
          <EmptyState title={copy.emptyMineTitle} body={copy.emptyMineBody} />
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
            {visibleTasks.length > 0 ? (
              <SummaryTiles
                theme={theme}
                tasks={visibleTasks}
                selected={frequencyFilter}
                onSelect={setFrequencyFilter}
              />
            ) : null}

            {(frequencyFilter ? [frequencyFilter] : TODAY_FREQUENCIES).map((frequency) => {
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
                      memberNames={memberNames}
                      onEditTemplate={
                        canEditTemplates
                          ? () =>
                              router.push(templateEditorHref(group.templateId), {
                                withAnchor: true,
                              })
                          : undefined
                      }
                      onToggle={(task) => void recurring.toggle(task)}
                      onBlock={(task) => {
                        setBlockNote(task.note ?? '');
                        setBlockTask(task);
                      }}
                    />
                  ))}
                </View>
              ) : null;
            })}
          </ScrollView>
        )}
      </View>
      <KitchenSwitcher visible={switcherOpen} onClose={() => setSwitcherOpen(false)} />
      <TickNoteModal
        visible={blockTask != null}
        note={blockNote}
        onChangeNote={setBlockNote}
        onClose={() => setBlockTask(null)}
        onSave={() => {
          if (!blockTask) return;
          void recurring.block(blockTask, blockNote);
          setBlockTask(null);
        }}
      />
    </Screen>
  );
}
