import { useCallback, useRef, useState } from 'react';
import {
  ActivityIndicator,
  ScrollView,
  View,
} from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { DateTime } from 'luxon';

import {
  Chip,
  EmptyState,
  ListRow,
  Screen,
  ScreenHeader,
  SyncBanner,
} from '@/components/ui';
import { useTheme } from '@/design';
import { useAuth } from '@/features/auth';
import { listHistory, type HistoryRow } from '@/features/history/api';
import { listRecentTicks, type TaskTick } from '@/features/recurring';
import { getDeviceTimeZone } from '@/lib/dates';
import { useSync } from '@/lib/sync';
import { t, tone } from '@/i18n';

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

export default function HistoryScreen() {
  const theme = useTheme();
  const { kitchenMode, user, kitchenId } = useAuth();
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

  return (
    <Screen>
      <View style={{ gap: theme.space.md, flex: 1 }}>
        <ScreenHeader title={copy.title} />

        <SyncBanner />

        <View
          style={{
            flexDirection: 'row',
            flexWrap: 'wrap',
            gap: theme.space.sm,
          }}
        >
          {chips.map((chip) => (
            <Chip
              key={chip.id}
              label={chip.label}
              selected={filter === chip.id}
              onPress={() => setFilter(chip.id)}
            />
          ))}
        </View>

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
              gap: theme.space.sm,
              paddingBottom: theme.space.xxl,
              alignItems: 'stretch',
            }}
          >
            {rows.map((entry) =>
              entry.kind === 'run' ? (
                <ListRow
                  key={entry.key}
                  title={entry.row.title}
                  subtitle={`${entry.localDate} · ${entry.row.summary}`}
                  onPress={() => router.push(`/(app)/runs/${entry.row.id}`)}
                />
              ) : (
                <ListRow
                  key={entry.key}
                  title={entry.tick.title}
                  subtitle={[
                    entry.localDate,
                    entry.tick.templateTitle,
                    t().recurring[entry.tick.frequency],
                    t().recurring.historyTicked.replace('{time}', entry.time),
                  ].join(' · ')}
                />
              ),
            )}
          </ScrollView>
        )}
      </View>
    </Screen>
  );
}
