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
import {
  AssigneeAvatar,
  AssigneePicker,
  AssignedToCard,
  effectiveAssignee,
  itemAssignmentFromPick,
  listAssigneeFromPick,
} from '@/features/assignment';
import { useAuth } from '@/features/auth';
import { isLibraryCopy } from '@/features/catalog';
import { listKitchenMembers, type KitchenMember } from '@/features/membership';
import {
  countDone,
  FrequencyTabs,
  openTasksFirst,
  RecurringTaskRow,
  TickNoteModal,
  TODAY_FREQUENCIES,
  useRecurringTasks,
  type FrequencyTab,
  type RecurringTaskState,
  type TaskFrequency,
} from '@/features/recurring';
import { findOpenRunForTemplate } from '@/features/runs';
import {
  getTemplate,
  saveTemplateAssignments,
  type TemplateDetail,
} from '@/features/templates/api';
import { t, useT } from '@/i18n';
import { templateEditorHref } from '@/lib/navigation';

type TabKey = 'all' | TaskFrequency;

type HubRow = {
  key: string;
  title: string;
  task: RecurringTaskState | undefined;
};

type HubGroup = { key: string; title: string | null; rows: HubRow[] };

function openHubRows(rows: HubRow[]): HubRow[] {
  return openTasksFirst(rows.map((row) => ({ ...row, done: Boolean(row.task?.done) })));
}

/** Rows grouped under their section, in template order; unsectioned rows first. */
function groupRows(
  detail: TemplateDetail,
  rows: (HubRow & { sectionId: string | null })[],
): HubGroup[] {
  const sections = [...detail.sections].sort((a, b) => a.sortOrder - b.sortOrder);
  const groups: HubGroup[] = [
    { key: 'none', title: null, rows: openHubRows(rows.filter((r) => !r.sectionId)) },
    ...sections.map((section) => ({
      key: section.id,
      title: section.title,
      rows: openHubRows(rows.filter((r) => r.sectionId === section.id)),
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
  const { kitchenId, user, canEditTemplates } = useAuth();
  const userId = user?.id;
  const copy = t().templates;
  const recurringCopy = t().recurring;

  const [loading, setLoading] = useState(true);
  const [assigning, setAssigning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [detail, setDetail] = useState<TemplateDetail | null>(null);
  const [members, setMembers] = useState<KitchenMember[]>([]);
  const [picker, setPicker] = useState<null | 'list' | string>(null);
  const [blockTask, setBlockTask] = useState<RecurringTaskState | null>(null);
  const [blockNote, setBlockNote] = useState('');
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
        const [open, fromLibrary, kitchenMembers] = await Promise.all([
          findOpenRunForTemplate(userId, kitchenId, templateId),
          isLibraryCopy(userId, kitchenId, templateId),
          listKitchenMembers(kitchenId).catch(() => [] as KitchenMember[]),
        ]);
        setOpenRunId(open?.runId ?? null);
        setLibraryCopy(fromLibrary);
        setMembers(kitchenMembers);
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

  const hasOpenRun = Boolean(openRunId);
  const canAssign =
    canEditTemplates && detail != null && detail.state !== 'archived' && Boolean(kitchenId);

  const persistAssignment = async (
    listAssigneeUserId: string | null,
    items: TemplateDetail['items'],
  ) => {
    if (!kitchenId || !detail) return;
    setAssigning(true);
    setError(null);
    try {
      const result = await saveTemplateAssignments({
        templateId,
        kitchenId,
        expectedRevision: detail.revision,
        assigneeUserId: listAssigneeUserId,
        items: items.map((item) => ({
          id: item.id,
          assignee_mode: item.assignment.mode,
          assignee_user_id: item.assignment.userId,
        })),
      });
      setDetail({
        ...detail,
        revision: result.revision,
        assigneeUserId: listAssigneeUserId,
        items,
      });
      await reloadRecurring();
    } catch (e) {
      setError(e instanceof Error ? e.message : t().common.errorGeneric);
    } finally {
      setAssigning(false);
    }
  };

  const onContinue = () => {
    if (openRunId) router.push(`/(app)/runs/${openRunId}`);
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
    ...TODAY_FREQUENCIES.flatMap((f) => {
      const tasks = recurring.tasks.filter((task) => task.frequency === f);
      return tasks.length > 0
        ? [
            {
              key: f,
              label: recurringCopy[f],
              badge: `${countDone(tasks)}/${tasks.length}`,
            },
          ]
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

        {detail ? (
          <AssignedToCard
            label={t().assignment.listLabel}
            hint={t().assignment.listHint}
            anyoneLabel={t().assignment.anyone}
            member={members.find((m) => m.userId === detail.assigneeUserId) ?? null}
            readOnly={!canAssign || assigning}
            onPress={() => setPicker('list')}
          />
        ) : null}

        <View style={{ gap: theme.space.md }}>
          <View style={{ flexDirection: 'row', gap: theme.space.md }}>
            {hasOpenRun ? (
              <Button
                label={copy.continueRun}
                icon="play"
                onPress={onContinue}
                style={{ flex: 1 }}
              />
            ) : null}
            {canEditTemplates ? (
              <Button
                label={copy.hubEditShort}
                icon="pencil"
                variant={hasOpenRun ? 'secondary' : undefined}
                onPress={() => router.push(templateEditorHref(templateId))}
                style={{ flex: 1 }}
              />
            ) : null}
          </View>
          {canEditTemplates && !libraryCopy ? (
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
                  {group.rows.map((row, index) => {
                    const item = detail?.items.find((i) => i.id === row.key);
                    const assignment = item?.assignment ?? {
                      mode: 'inherit' as const,
                      userId: null,
                    };
                    const effectiveId = effectiveAssignee(
                      detail?.assigneeUserId ?? null,
                      assignment,
                    );
                    return (
                      <RecurringTaskRow
                        key={row.key}
                        title={row.title}
                        caption={frequencyLabel(row.task)}
                        note={row.task?.note}
                        done={row.task?.done ?? false}
                        outcome={row.task?.outcome ?? null}
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
                        onBlock={
                          row.task
                            ? () => {
                                const task = row.task;
                                if (!task) return;
                                setBlockNote(task.note ?? '');
                                setBlockTask(task);
                              }
                            : undefined
                        }
                        onAssign={canAssign ? () => setPicker(row.key) : undefined}
                        assignLabel={t().assignment.listLabel}
                        trailing={
                          <AssigneeAvatar
                            size={28}
                            userId={effectiveId}
                            name={
                              members.find((m) => m.userId === effectiveId)?.displayName ??
                              t().assignment.anyone
                            }
                            override={assignment.mode === 'explicit' && Boolean(effectiveId)}
                          />
                        }
                      />
                    );
                  })}
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
                {recurringCopy.localNote}
              </Text>
            ) : null}
          </View>
        ) : null}
      </View>
      <AssigneePicker
        visible={picker != null}
        onClose={() => setPicker(null)}
        members={members}
        currentUserId={userId}
        inheritMember={
          picker != null && picker !== 'list' && detail?.assigneeUserId
            ? {
                userId: detail.assigneeUserId,
                name:
                  members.find((m) => m.userId === detail.assigneeUserId)?.displayName ??
                  t().assignment.anyone,
              }
            : null
        }
        inheritSelected={
          picker != null &&
          picker !== 'list' &&
          Boolean(detail?.assigneeUserId) &&
          detail?.items.find((i) => i.id === picker)?.assignment.mode === 'inherit'
        }
        selectedUserId={
          picker === 'list'
            ? (detail?.assigneeUserId ?? null)
            : picker
              ? (detail?.items.find((i) => i.id === picker)?.assignment.userId ?? null)
              : null
        }
        onPick={(pick) => {
          if (!detail) return;
          const pickedUserId = pick.kind === 'member' ? pick.userId : undefined;
          if (picker === 'list') {
            void persistAssignment(listAssigneeFromPick(pick.kind, pickedUserId), detail.items);
            return;
          }
          if (!picker) return;
          const nextItems = detail.items.map((item) =>
            item.id === picker
              ? {
                  ...item,
                  assignment: itemAssignmentFromPick(pick.kind, pickedUserId),
                }
              : item,
          );
          void persistAssignment(detail.assigneeUserId, nextItems);
        }}
      />
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
