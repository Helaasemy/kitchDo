import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  ScrollView,
  View,
} from 'react-native';
import { router, useFocusEffect } from 'expo-router';

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
import { useSync } from '@/lib/sync';
import { t, tone } from '@/i18n';

type Filter = 'all' | 'finished' | 'unfinished';

export default function HistoryScreen() {
  const theme = useTheme();
  const { kitchenMode, user, kitchenId } = useAuth();
  const { refresh } = useSync();
  const copy = t().history;

  const [rows, setRows] = useState<HistoryRow[]>([]);
  const [filter, setFilter] = useState<Filter>('all');
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!user?.id || !kitchenId) {
      setRows([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      await refresh();
      setRows(
        await listHistory(user.id, kitchenId, {
          state: filter,
        }),
      );
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
            {rows.map((row) => (
              <ListRow
                key={row.id}
                title={row.title}
                subtitle={`${row.localDate} · ${row.summary}`}
                onPress={() => router.push(`/(app)/runs/${row.id}`)}
              />
            ))}
          </ScrollView>
        )}
      </View>
    </Screen>
  );
}
