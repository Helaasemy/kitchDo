import { useCallback, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  Text,
  View,
} from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { router, useFocusEffect } from 'expo-router';
import { DateTime } from 'luxon';

import {
  Chip,
  ChipScroller,
  EmptyState,
  IconButton,
  PaperCard,
  Screen,
  ScreenHeader,
  SectionChip,
  SyncBanner,
} from '@/components/ui';
import { useTheme, type AppTheme } from '@/design';
import { useAuth } from '@/features/auth';
import { listHistory, type HistoryRow } from '@/features/history/api';
import { listRecentTicks, type TaskTick } from '@/features/recurring';
import { getDeviceTimeZone } from '@/lib/dates';
import { useSync } from '@/lib/sync';
import { t, useT, tone } from '@/i18n';

type Filter = 'all' | 'finished' | 'unfinished';

type Entry =
  | { kind: 'run'; key: string; localDate: string; row: HistoryRow }
  | { kind: 'tick'; key: string; localDate: string; tick: TaskTick; time: string };

/** Runs and recurring ticks in one list, newest day first. */
function mergeEntries(rows: HistoryRow[], ticks: TaskTick[]): Entry[] {
  const zone = getDeviceTimeZone();
  const entries: Entry[] = [
    ...rows.map((row) => ({
      kind: 'run' as const,
      key: `run:${row.id}`,
      localDate: row.localDate,
      row,
    })),
    ...ticks.map((tick) => {
      const at = DateTime.fromISO(tick.tickedAt).setZone(zone);
      return {
        kind: 'tick' as const,
        key: `tick:${tick.itemId}:${tick.periodKey}`,
        localDate: at.toFormat('yyyy-MM-dd'),
        time: at.toFormat('HH:mm'),
        tick,
      };
    }),
  ];
  return entries.sort((a, b) => b.localDate.localeCompare(a.localDate));
}

type Day = { localDate: string; entries: Entry[] };

function groupByDay(entries: Entry[]): Day[] {
  const days: Day[] = [];
  for (const entry of entries) {
    const last = days[days.length - 1];
    if (last && last.localDate === entry.localDate) last.entries.push(entry);
    else days.push({ localDate: entry.localDate, entries: [entry] });
  }
  return days;
}

function dayLabel(localDate: string): string {
  const copy = t().history;
  const zone = getDeviceTimeZone();
  const day = DateTime.fromISO(localDate, { zone });
  if (!day.isValid) return localDate;
  const today = DateTime.now().setZone(zone).startOf('day');
  const diff = Math.round(today.diff(day.startOf('day'), 'days').days);
  const formatted = day.toFormat('ccc d LLL');
  if (diff === 0) return `${copy.today} · ${formatted}`;
  if (diff === 1) return copy.yesterday;
  return formatted;
}

function EntryRow({
  entry,
  theme,
  divider,
}: {
  entry: Entry;
  theme: AppTheme;
  divider: boolean;
}) {
  const t = useT();
  const recurringCopy = t().recurring;
  let leading;
  let title: string;
  let subtitle: string;
  let alert = false;
  let onPress: (() => void) | undefined;

  if (entry.kind === 'run') {
    const { row } = entry;
    const finished = row.state === 'finished';
    alert = row.blocked > 0;
    title = row.title;
    subtitle = row.summary;
    onPress = () => router.push(`/(app)/runs/${row.id}`);
    leading = (
      <Ionicons
        name={alert ? 'alert-circle' : finished ? 'checkmark-circle' : 'time-outline'}
        size={24}
        color={
          alert
            ? theme.colors.coral
            : finished
              ? theme.colors.frequency.monthly.text
              : theme.colors.inkMuted
        }
      />
    );
  } else {
    const { tick } = entry;
    alert = tick.outcome === 'blocked';
    title = tick.title;
    subtitle = [
      tick.templateTitle,
      recurringCopy[tick.frequency],
      tick.outcome === 'blocked' ? t().runs.blocked : null,
      tick.note,
      recurringCopy.historyTicked.replace('{time}', entry.time),
    ]
      .filter(Boolean)
      .join(' · ');
    leading = (
      <View style={{ width: 24, alignItems: 'center' }}>
        <View
          style={{
            width: 10,
            height: 10,
            borderRadius: 5,
            backgroundColor: alert
              ? theme.colors.coral
              : theme.colors.frequency[tick.frequency].base,
          }}
        />
      </View>
    );
  }

  return (
    <Pressable
      accessibilityRole={onPress ? 'button' : undefined}
      accessibilityLabel={`${title}, ${subtitle}`}
      disabled={!onPress}
      onPress={onPress}
      style={({ pressed }) => ({
        minHeight: entry.kind === 'run' ? 72 : 64,
        flexDirection: 'row',
        alignItems: 'center',
        gap: theme.space.lg,
        paddingVertical: theme.space.md,
        paddingHorizontal: theme.space.xl - 4,
        borderBottomWidth: divider ? 0.5 : 0,
        borderBottomColor: theme.colors.border,
        backgroundColor: pressed ? theme.colors.sand : 'transparent',
      })}
    >
      {leading}
      <View style={{ flex: 1, gap: 2 }}>
        <Text
          style={{
            fontFamily: theme.fonts.bodyBold,
            fontSize: theme.typography.body.fontSize,
            lineHeight: 22,
            color: theme.colors.ink,
          }}
          numberOfLines={2}
          allowFontScaling
        >
          {title}
        </Text>
        <Text
          style={{
            fontFamily: alert ? theme.fonts.bodySemiBold : theme.fonts.bodyMedium,
            fontSize: theme.typography.label.fontSize,
            lineHeight: theme.typography.label.lineHeight,
            color: alert ? theme.colors.coral : theme.colors.inkMuted,
          }}
          numberOfLines={2}
          allowFontScaling
        >
          {subtitle}
        </Text>
      </View>
      {onPress ? (
        <Ionicons name="chevron-forward" size={14} color={theme.colors.inkSubtle} />
      ) : null}
    </Pressable>
  );
}

export default function HistoryScreen() {
  const t = useT();
  const theme = useTheme();
  const { kitchenMode, onboarding, user, kitchenId } = useAuth();
  const { refresh } = useSync();
  const copy = t().history;

  const [rows, setRows] = useState<Entry[]>([]);
  const [filter, setFilter] = useState<Filter>('all');
  const [loading, setLoading] = useState(true);
  const hasLoaded = useRef(false);
  const lastFilter = useRef<Filter>(filter);

  const load = useCallback(async () => {
    if (!user?.id || !kitchenId) {
      setRows([]);
      setLoading(false);
      return;
    }
    const filterChanged = lastFilter.current !== filter;
    lastFilter.current = filter;
    if (!hasLoaded.current || filterChanged) setLoading(true);
    try {
      await refresh();
      const [runs, ticks] = await Promise.all([
        listHistory(user.id, kitchenId, { state: filter }),
        filter === 'unfinished'
          ? Promise.resolve([] as TaskTick[])
          : listRecentTicks(user.id, kitchenId),
      ]);
      setRows(mergeEntries(runs, ticks));
      hasLoaded.current = true;
    } finally {
      setLoading(false);
    }
  }, [user?.id, kitchenId, filter, refresh]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  const chips: { id: Filter; label: string }[] = [
    { id: 'all', label: copy.filterAll },
    { id: 'finished', label: copy.filterFinished },
    { id: 'unfinished', label: copy.filterUnfinished },
  ];

  const days = groupByDay(rows);

  return (
    <Screen>
      <View style={{ gap: theme.space.lg, flex: 1 }}>
        <ScreenHeader
          size="display"
          eyebrow={onboarding?.kitchenName || undefined}
          title={copy.title}
          right={
            <IconButton
              name="settings-outline"
              accessibilityLabel={t().settings.title}
              onPress={() => router.push('/(app)/settings')}
            />
          }
        />

        <SyncBanner />

        <ChipScroller scroll>
          {chips.map((chip) => (
            <Chip
              key={chip.id}
              label={chip.label}
              selected={filter === chip.id}
              onPress={() => setFilter(chip.id)}
            />
          ))}
        </ChipScroller>

        {loading ? (
          <View style={{ paddingTop: theme.space.xl, alignItems: 'center' }}>
            <ActivityIndicator color={theme.colors.primary} />
          </View>
        ) : rows.length === 0 ? (
          <EmptyState
            title={tone(kitchenMode, copy.emptyTitleHome, copy.emptyTitleBusiness)}
            body={tone(kitchenMode, copy.emptyBodyHome, copy.emptyBodyBusiness)}
          />
        ) : (
          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{
              gap: theme.space.xxl,
              paddingBottom: theme.space.xxxl,
              alignItems: 'stretch',
            }}
          >
            {days.map((day) => (
              <View key={day.localDate} style={{ gap: theme.space.md }}>
                <SectionChip label={dayLabel(day.localDate)} />
                <PaperCard>
                  {day.entries.map((entry, index) => (
                    <EntryRow
                      key={entry.key}
                      entry={entry}
                      theme={theme}
                      divider={index < day.entries.length - 1}
                    />
                  ))}
                </PaperCard>
              </View>
            ))}
          </ScrollView>
        )}
      </View>
    </Screen>
  );
}
