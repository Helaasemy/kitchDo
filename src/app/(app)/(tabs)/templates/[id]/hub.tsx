import { useCallback, useState } from 'react';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';

import { Button, Screen } from '@/components/ui';
import { useTheme } from '@/design';
import { useAuth } from '@/features/auth';
import { isLibraryCopy } from '@/features/catalog';
import {
  countDone,
  FrequencyTabs,
  RecurringTaskRow,
  TASK_FREQUENCIES,
  useRecurringTasks,
  type FrequencyTab,
  type TaskFrequency,
} from '@/features/recurring';
import {
  findOpenRunForTemplate,
  startManualRunFromTemplate,
} from '@/features/runs';
import { getTemplate, type TemplateDetail } from '@/features/templates/api';
import { goBackOr } from '@/lib/navigation';
import { t } from '@/i18n';

type TabKey = 'all' | TaskFrequency;

function stateLabel(state: TemplateDetail['state']): string {
  const copy = t().templates;
  if (state === 'active') return copy.stateActive;
  if (state === 'archived') return copy.stateArchived;
  return copy.stateDraft;
}

export default function TemplateHubScreen() {
  const theme = useTheme();
  const { id } = useLocalSearchParams<{ id: string }>();
  const templateId = String(id);
  const { kitchenId, user } = useAuth();
  const userId = user?.id;
  const copy = t().templates;
  const recurringCopy = t().recurring;

  const [loading, setLoading] = useState(true);
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [detail, setDetail] = useState<TemplateDetail | null>(null);
  const [openRunId, setOpenRunId] = useState<string | null>(null);
  const [tab, setTab] = useState<TabKey>('all');
  const [libraryCopy, setLibraryCopy] = useState(false);
  const recurring = useRecurringTasks(userId, kitchenId, templateId);
  const reloadRecurring = recurring.reload;

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      await reloadRecurring();
      const tmpl = await getTemplate(templateId);
      setDetail(tmpl);
      if (!tmpl) {
        setError(t().common.errorGeneric);
        setOpenRunId(null);
        return;
      }

      if (userId && kitchenId) {
        const [open, fromLibrary] = await Promise.all([
          findOpenRunForTemplate(userId, kitchenId, templateId),
          isLibraryCopy(userId, kitchenId, templateId),
        ]);
        setOpenRunId(open?.runId ?? null);
        setLibraryCopy(fromLibrary);
      } else {
        setOpenRunId(null);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : t().common.errorGeneric);
    } finally {
      setLoading(false);
    }
  }, [templateId, userId, kitchenId, reloadRecurring]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  const canStart =
    Boolean(detail?.publishedRevision) && detail?.state !== 'archived';
  const hasOpenRun = Boolean(openRunId);

  const onPrimary = async () => {
    if (!kitchenId || !user?.id) {
      setError(copy.needKitchen);
      return;
    }

    if (openRunId) {
      router.push(`/(app)/runs/${openRunId}`);
      return;
    }

    setStarting(true);
    setError(null);
    try {
      const { runId } = await startManualRunFromTemplate({
        userId: user.id,
        kitchenId,
        templateId,
      });
      router.push(`/(app)/runs/${runId}`);
    } catch (e) {
      if (e instanceof Error && e.message === 'NO_PUBLISHED_REVISION') {
        setError(copy.publishFirst);
      } else {
        setError(e instanceof Error ? e.message : t().common.errorGeneric);
      }
    } finally {
      setStarting(false);
    }
  };

  if (loading) {
    return (
      <Screen>
        <ActivityIndicator
          color={theme.colors.primary}
          style={{ marginTop: theme.space.xxl }}
        />
      </Screen>
    );
  }

  const itemCount = detail?.items.length ?? 0;
  const sectionCount = detail?.sections.length ?? 0;
  const itemLabel =
    itemCount === 1
      ? copy.hubItemCountOne
      : copy.hubItemCount.replace('{count}', String(itemCount));
  const sectionLabel =
    sectionCount === 1
      ? copy.hubSectionCountOne
      : copy.hubSectionCount.replace('{count}', String(sectionCount));

  const recurringById = new Map(recurring.tasks.map((task) => [task.itemId, task]));
  const sectionTitleById = new Map(
    (detail?.sections ?? []).map((s) => [s.id, s.title]),
  );
  const frequencyTabs: FrequencyTab<TabKey>[] = [
    { key: 'all', label: recurringCopy.tabAll },
    ...TASK_FREQUENCIES.flatMap((f) => {
      const tasks = recurring.tasks.filter((task) => task.frequency === f);
      return tasks.length > 0
        ? [{ key: f, label: recurringCopy[f], badge: `${countDone(tasks)}/${tasks.length}` }]
        : [];
    }),
  ];
  const activeTab = frequencyTabs.some((x) => x.key === tab) ? tab : 'all';
  const tabTasks =
    activeTab === 'all'
      ? []
      : recurring.tasks.filter((task) => task.frequency === activeTab);

  return (
    <Screen scroll>
      <View style={{ paddingTop: theme.space.sm, gap: theme.space.lg }}>
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <Pressable
            onPress={() => goBackOr('/(app)/(tabs)/templates')}
            hitSlop={12}
          >
            <Text
              style={{
                fontFamily: theme.fonts.bodyMedium,
                color: theme.colors.primary,
                fontSize: theme.typography.body.fontSize,
              }}
              allowFontScaling
            >
              {t().common.back}
            </Text>
          </Pressable>
          <Text
            style={{
              fontFamily: theme.fonts.displayRegular,
              fontSize: theme.typography.heading.fontSize,
              color: theme.colors.ink,
            }}
            allowFontScaling
          >
            {copy.hubTitle}
          </Text>
          <View style={{ width: 48 }} />
        </View>

        <View style={{ gap: theme.space.sm }}>
          <Text
            style={{
              fontFamily: theme.fonts.display,
              fontSize: theme.typography.title.fontSize,
              color: theme.colors.ink,
            }}
            allowFontScaling
          >
            {detail?.title ?? copy.hubTitle}
          </Text>
          {detail?.description ? (
            <Text
              style={{
                fontFamily: theme.fonts.body,
                fontSize: theme.typography.body.fontSize,
                color: theme.colors.inkMuted,
                lineHeight: theme.typography.body.lineHeight,
              }}
              allowFontScaling
            >
              {detail.description}
            </Text>
          ) : null}
          <Text
            style={{
              fontFamily: theme.fonts.bodyMedium,
              fontSize: theme.typography.caption.fontSize,
              color: theme.colors.inkMuted,
            }}
            allowFontScaling
          >
            {detail ? stateLabel(detail.state) : ''}
            {detail ? ` · ${itemLabel}` : ''}
            {sectionCount > 0 ? ` · ${sectionLabel}` : ''}
          </Text>
        </View>

        {detail?.state === 'archived' ? (
          <Text
            style={{
              fontFamily: theme.fonts.body,
              color: theme.colors.coral,
              fontSize: theme.typography.caption.fontSize,
            }}
            allowFontScaling
          >
            {copy.hubArchivedHint}
          </Text>
        ) : null}

        {hasOpenRun ? (
          <Text
            style={{
              fontFamily: theme.fonts.body,
              color: theme.colors.inkMuted,
              fontSize: theme.typography.body.fontSize,
            }}
            allowFontScaling
          >
            {copy.hubOpenRunHint}
          </Text>
        ) : null}

        {!canStart && !hasOpenRun && detail?.state !== 'archived' ? (
          <Text
            style={{
              fontFamily: theme.fonts.body,
              color: theme.colors.inkMuted,
              fontSize: theme.typography.body.fontSize,
            }}
            allowFontScaling
          >
            {copy.hubNoPublished}
          </Text>
        ) : null}

        {error ? (
          <Text
            style={{
              fontFamily: theme.fonts.body,
              color: theme.colors.coral,
              fontSize: theme.typography.caption.fontSize,
            }}
            allowFontScaling
          >
            {error}
          </Text>
        ) : null}

        <View style={{ gap: theme.space.sm }}>
          <Button
            label={hasOpenRun ? copy.continueRun : copy.useNow}
            loading={starting}
            disabled={!hasOpenRun && !canStart}
            onPress={() => void onPrimary()}
          />
          <Button
            label={copy.hubEdit}
            variant="secondary"
            onPress={() => router.push(`/(app)/(tabs)/templates/${templateId}`)}
          />
          {!libraryCopy ? (
            <Button
              label={copy.addSchedule}
              variant="secondary"
              onPress={() =>
                router.push(`/(app)/(tabs)/templates/${templateId}/schedule`)
              }
            />
          ) : null}
        </View>

        {itemCount > 0 ? (
          <View style={{ gap: theme.space.sm }}>
            {frequencyTabs.length > 1 ? (
              <FrequencyTabs tabs={frequencyTabs} value={activeTab} onChange={setTab} />
            ) : null}
            {activeTab === 'all'
              ? detail?.items.map((item) => {
                  const task = recurringById.get(item.id);
                  const section = item.sectionId
                    ? sectionTitleById.get(item.sectionId)
                    : null;
                  const frequencyLabel = task
                    ? recurringCopy[task.frequency]
                    : recurringCopy.oneOff;
                  return (
                    <RecurringTaskRow
                      key={item.id}
                      title={item.title}
                      caption={[frequencyLabel, section].filter(Boolean).join(' · ')}
                      done={task?.done ?? false}
                      onToggle={task ? () => void recurring.toggle(task) : undefined}
                    />
                  );
                })
              : tabTasks.map((task) => (
                  <RecurringTaskRow
                    key={task.itemId}
                    title={task.title}
                    caption={task.sectionTitle}
                    done={task.done}
                    onToggle={() => void recurring.toggle(task)}
                  />
                ))}
            {recurring.tasks.length > 0 ? (
              <Text
                style={{
                  fontFamily: theme.fonts.body,
                  fontSize: theme.typography.caption.fontSize,
                  color: theme.colors.inkSubtle,
                }}
                allowFontScaling
              >
                {recurring.tasks.length < itemCount
                  ? `${recurringCopy.oneOffHint} ${recurringCopy.localNote}`
                  : recurringCopy.localNote}
              </Text>
            ) : null}
          </View>
        ) : null}
      </View>
    </Screen>
  );
}
