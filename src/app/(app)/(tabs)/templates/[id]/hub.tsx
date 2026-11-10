import { useCallback, useState } from 'react';
import { ActivityIndicator, Text, View } from 'react-native';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';

import {
  BackLink,
  Button,
  PaperCard,
  Screen,
  ScreenHeader,
  SectionLabel,
} from '@/components/ui';
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
  type RecurringTaskState,
  type TaskFrequency,
} from '@/features/recurring';
import {
  findOpenRunForTemplate,
  startManualRunFromTemplate,
} from '@/features/runs';
import { getTemplate, type TemplateDetail } from '@/features/templates/api';
import { t, useT } from '@/i18n';

type TabKey = 'all' | TaskFrequency;

type HubRow = {
  key: string;
  title: string;
  task: RecurringTaskState | undefined;
};

type HubGroup = { key: string; title: string | null; rows: HubRow[] };

/** Rows grouped under their section, in template order; unsectioned rows first. */
function groupRows(
  detail: TemplateDetail,
  rows: (HubRow & { sectionId: string | null })[],
): HubGroup[] {
  const sections = [...detail.sections].sort((a, b) => a.sortOrder - b.sortOrder);
  const groups: HubGroup[] = [
    { key: 'none', title: null, rows: rows.filter((r) => !r.sectionId) },
    ...sections.map((section) => ({
      key: section.id,
      title: section.title,
      rows: rows.filter((r) => r.sectionId === section.id),
    })),
  ];
  return groups.filter((g) => g.rows.length > 0);
}

function stateLabel(state: TemplateDetail['state']): string {
  const copy = t().templates;
  if (state === 'active') return copy.stateActive;
  if (state === 'archived') return copy.stateArchived;
  return copy.stateDraft;
}

export default function TemplateHubScreen() {
  const t = useT();
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
  }, [templateId, userId, kitchenId, reloadRecurring, t]);

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

  const frequencyLabel = (task: RecurringTaskState | undefined) =>
    task ? recurringCopy[task.frequency] : recurringCopy.oneOff;

  const sectionIdByItem = new Map((detail?.items ?? []).map((i) => [i.id, i.sectionId]));
  const rows =
    activeTab === 'all'
      ? (detail?.items ?? []).map((item) => ({
          key: item.id,
          title: item.title,
          task: recurringById.get(item.id),
          sectionId: item.sectionId,
        }))
      : tabTasks.map((task) => ({
          key: task.itemId,
          title: task.title,
          task,
          sectionId: sectionIdByItem.get(task.itemId) ?? null,
        }));
  const groups = detail ? groupRows(detail, rows) : [];

  const notice = (text: string, tone: 'muted' | 'alert' = 'muted') => (
    <Text
      style={{
        fontFamily: theme.fonts.bodyMedium,
        color: tone === 'alert' ? theme.colors.coral : theme.colors.inkMuted,
        fontSize: theme.typography.bodySmall.fontSize,
        lineHeight: theme.typography.bodySmall.lineHeight,
      }}
      allowFontScaling
    >
      {text}
    </Text>
  );

  return (
    <Screen scroll>
      <View style={{ gap: theme.space.xl }}>
        <View style={{ gap: theme.space.xs }}>
          <BackLink label={t().tabs.templates} fallback="/(app)/(tabs)/templates" />
          <ScreenHeader
            size="display"
            eyebrow={copy.hubTitle}
            title={detail?.title ?? copy.hubTitle}
          />
          <Text
            style={{
              fontFamily: theme.fonts.bodyMedium,
              fontSize: theme.typography.bodySmall.fontSize,
              color: theme.colors.inkMuted,
            }}
            allowFontScaling
          >
            {[
              detail && detail.state !== 'active' ? stateLabel(detail.state) : null,
              detail ? itemLabel : null,
              sectionCount > 0 ? sectionLabel : null,
            ]
              .filter(Boolean)
              .join(' · ')}
          </Text>
          {detail?.description ? (
            <Text
              style={{
                fontFamily: theme.fonts.body,
                fontSize: theme.typography.body.fontSize,
                lineHeight: theme.typography.body.lineHeight,
                color: theme.colors.inkMuted,
                marginTop: theme.space.xs,
              }}
              allowFontScaling
            >
              {detail.description}
            </Text>
          ) : null}
        </View>

        <View style={{ gap: theme.space.md }}>
          <View style={{ flexDirection: 'row', gap: theme.space.md }}>
            <Button
              label={hasOpenRun ? copy.continueRun : copy.useNow}
              icon="play"
              loading={starting}
              disabled={!hasOpenRun && !canStart}
              onPress={() => void onPrimary()}
              style={{ flex: 1 }}
            />
            <Button
              label={copy.hubEditShort}
              icon="pencil"
              variant="secondary"
              onPress={() => router.push(`/(app)/(tabs)/templates/${templateId}`)}
              style={{ flex: 1 }}
            />
          </View>
          {!libraryCopy ? (
            <Button
              label={copy.addSchedule}
              icon="calendar-outline"
              variant="ghost"
              compact
              onPress={() =>
                router.push(`/(app)/(tabs)/templates/${templateId}/schedule`)
              }
            />
          ) : null}
          {detail?.state === 'archived' ? notice(copy.hubArchivedHint, 'alert') : null}
          {hasOpenRun ? notice(copy.hubOpenRunHint) : null}
          {!canStart && !hasOpenRun && detail?.state !== 'archived'
            ? notice(copy.hubNoPublished)
            : null}
          {error ? notice(error, 'alert') : null}
        </View>

        {itemCount > 0 ? (
          <View style={{ gap: theme.space.xl }}>
            {frequencyTabs.length > 1 ? (
              <FrequencyTabs tabs={frequencyTabs} value={activeTab} onChange={setTab} />
            ) : null}
            {groups.map((group) => (
              <View key={group.key} style={{ gap: theme.space.md }}>
                {group.title ? (
                  <View style={{ paddingHorizontal: theme.space.xs }}>
                    <SectionLabel>{group.title}</SectionLabel>
                  </View>
                ) : null}
                <PaperCard>
                  {group.rows.map((row, index) => (
                    <RecurringTaskRow
                      key={row.key}
                      title={row.title}
                      caption={frequencyLabel(row.task)}
                      done={row.task?.done ?? false}
                      accent={
                        row.task ? theme.colors.frequency[row.task.frequency] : undefined
                      }
                      grouped
                      divider={index < group.rows.length - 1}
                      onToggle={
                        row.task
                          ? () => {
                              const task = row.task;
                              if (task) void recurring.toggle(task);
                            }
                          : undefined
                      }
                    />
                  ))}
                </PaperCard>
              </View>
            ))}
            {recurring.tasks.length > 0 ? (
              <Text
                style={{
                  fontFamily: theme.fonts.bodyMedium,
                  fontSize: theme.typography.caption.fontSize,
                  lineHeight: theme.typography.caption.lineHeight,
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
