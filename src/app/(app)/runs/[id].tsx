import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useFocusEffect, useLocalSearchParams } from 'expo-router';
import { DateTime } from 'luxon';

import { Button, DueCountdownRing, Screen, SyncBanner } from '@/components/ui';
import { useTheme } from '@/design';
import { useAuth } from '@/features/auth';
import {
  RunChecklistItem,
  applyItemOutcome,
  getRunDetail,
  reopenItem,
  resolveIssue,
  type RunDetail,
  type RunItemView,
} from '@/features/runs';
import type { RunItemOutcome } from '@/domain/runProgress';
import { getDeviceTimeZone, getDueCountdown } from '@/lib/dates';
import { goBackOr } from '@/lib/navigation';
import { t } from '@/i18n';

type NoteModal =
  | {
      kind: 'outcome';
      item: RunItemView;
      outcome: 'done' | 'not_applicable' | 'blocked';
      requireNote: boolean;
    }
  | { kind: 'resolve'; issueId: string }
  | null;

export default function RunExecutionScreen() {
  const theme = useTheme();
  const params = useLocalSearchParams<{ id: string | string[] }>();
  const runId = Array.isArray(params.id) ? params.id[0] : params.id;
  const { user, kitchenId } = useAuth();
  const copy = t().runs;

  const todayCopy = t().today;
  const [detail, setDetail] = useState<RunDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [modal, setModal] = useState<NoteModal>(null);
  const [note, setNote] = useState('');
  const [now, setNow] = useState(() => DateTime.now());

  const load = useCallback(async () => {
    if (!user?.id || !runId) return;
    setLoading(true);
    try {
      setDetail(await getRunDetail(user.id, runId));
      setNow(DateTime.now());
    } finally {
      setLoading(false);
    }
  }, [user?.id, runId]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  useEffect(() => {
    const id = setInterval(() => setNow(DateTime.now()), 30_000);
    return () => clearInterval(id);
  }, []);

  const dueLabel = useMemo(() => {
    if (!detail) return '';
    const zone = detail.timezone || getDeviceTimeZone();
    const today = DateTime.now().setZone(zone).toISODate();
    const start = DateTime.fromISO(detail.scheduledFor, { setZone: true }).setZone(
      zone,
    );
    const time = start.isValid ? start.toFormat('HH:mm') : '';
    const due = detail.dueAt
      ? DateTime.fromISO(detail.dueAt, { setZone: true }).setZone(zone)
      : null;
    const window = due?.isValid
      ? `${time} → ${due.toFormat('HH:mm')}`
      : time;
    // Phone status bar already shows today's date — only name past dates.
    if (detail.localDate === today) return window || '';
    return window ? `${detail.localDate} · ${window}` : detail.localDate;
  }, [detail]);

  const countdown = useMemo(() => {
    if (!detail) return null;
    return getDueCountdown(detail.dueAt, {
      now,
      finished: detail.state === 'finished' || detail.state === 'cancelled',
      dueIn: todayCopy.dueIn,
      overdueBy: todayCopy.overdueBy,
      scheduledFor: detail.scheduledFor,
    });
  }, [detail, now, todayCopy.dueIn, todayCopy.overdueBy]);

  const sections = useMemo(() => {
    if (!detail) return [] as { title: string | null; items: RunItemView[] }[];
    const map = new Map<string, RunItemView[]>();
    const order: string[] = [];
    for (const item of detail.items) {
      const key = item.sectionTitle ?? '';
      if (!map.has(key)) {
        map.set(key, []);
        order.push(key);
      }
      map.get(key)!.push(item);
    }
    return order.map((key) => ({
      title: key || null,
      items: map.get(key) ?? [],
    }));
  }, [detail]);

  async function applyOutcome(
    item: RunItemView,
    outcome: RunItemOutcome,
    outcomeNote?: string | null,
  ) {
    if (!user?.id || !kitchenId) return;
    setBusyId(item.id);
    try {
      await applyItemOutcome({
        userId: user.id,
        kitchenId,
        runItemId: item.id,
        outcome,
        note: outcomeNote,
      });
      await load();
    } catch (e) {
      Alert.alert(
        t().common.errorGeneric,
        e instanceof Error ? e.message : t().common.errorGeneric,
      );
    } finally {
      setBusyId(null);
    }
  }

  function openOutcomeModal(
    item: RunItemView,
    outcome: 'done' | 'not_applicable' | 'blocked',
  ) {
    setNote(item.note ?? '');
    setModal({
      kind: 'outcome',
      item,
      outcome,
      requireNote: outcome !== 'done',
    });
  }

  async function toggleDone(item: RunItemView) {
    if (!user?.id || !kitchenId || busyId) return;
    if (item.outcome === 'pending') {
      await applyOutcome(item, 'done', null);
      return;
    }
    setBusyId(item.id);
    try {
      await reopenItem({
        userId: user.id,
        kitchenId,
        runItemId: item.id,
      });
      await load();
    } catch (e) {
      Alert.alert(
        t().common.errorGeneric,
        e instanceof Error ? e.message : t().common.errorGeneric,
      );
    } finally {
      setBusyId(null);
    }
  }

  async function confirmModal() {
    if (!modal || !user?.id || !kitchenId) return;
    if (modal.kind === 'outcome') {
      if (modal.requireNote && !note.trim()) {
        Alert.alert(copy.noteRequired);
        return;
      }
      setModal(null);
      await applyOutcome(
        modal.item,
        modal.outcome,
        note.trim() || null,
      );
      return;
    }
    setBusyId(modal.issueId);
    try {
      await resolveIssue({
        userId: user.id,
        kitchenId,
        issueId: modal.issueId,
        resolutionNote: note.trim() || null,
      });
      setModal(null);
      await load();
    } catch (e) {
      Alert.alert(
        t().common.errorGeneric,
        e instanceof Error ? e.message : t().common.errorGeneric,
      );
    } finally {
      setBusyId(null);
    }
  }

  if (loading && !detail) {
    return (
      <Screen>
        <ActivityIndicator color={theme.colors.primary} style={{ marginTop: 40 }} />
      </Screen>
    );
  }

  if (!detail) {
    return (
      <Screen>
        <View style={{ paddingTop: theme.space.sm, gap: theme.space.md }}>
          <Pressable onPress={() => goBackOr()} hitSlop={12}>
            <Text
              style={{
                fontFamily: theme.fonts.bodyMedium,
                color: theme.colors.primary,
              }}
            >
              {t().common.back}
            </Text>
          </Pressable>
          <Text style={{ color: theme.colors.inkMuted }}>{copy.missingRun}</Text>
        </View>
      </Screen>
    );
  }

  const total = detail.done + detail.notApplicable + detail.blocked + detail.pending;
  const completed = detail.done + detail.notApplicable + detail.blocked;

  return (
    <Screen>
      <View style={{ flex: 1, gap: theme.space.md, paddingTop: theme.space.sm }}>
        <View
          style={{
            flexDirection: 'row',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <Pressable onPress={() => goBackOr()} hitSlop={12}>
            <Text
              style={{
                fontFamily: theme.fonts.bodyMedium,
                color: theme.colors.primary,
              }}
            >
              {t().common.back}
            </Text>
          </Pressable>
          <Text
            style={{
              fontFamily: theme.fonts.label,
              color: theme.colors.inkSubtle,
              textTransform: 'uppercase',
            }}
          >
            {detail.state === 'finished'
              ? copy.finished
              : detail.state === 'in_progress'
                ? copy.inProgress
                : copy.notStarted}
          </Text>
        </View>

        <SyncBanner />

        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ gap: theme.space.md, paddingBottom: 48 }}
        >
          {detail.pendingCreate ? (
            <Text
              style={{
                fontFamily: theme.fonts.body,
                color: theme.colors.inkMuted,
                fontSize: theme.typography.caption.fontSize,
              }}
            >
              {t().sync.syncing}
            </Text>
          ) : null}

          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: theme.space.md,
            }}
          >
            <View style={{ flex: 1, gap: theme.space.xs, minWidth: 0 }}>
              <Text
                style={{
                  fontFamily: theme.fonts.display,
                  fontSize: theme.typography.heading.fontSize,
                  lineHeight: theme.typography.heading.lineHeight,
                  color: theme.colors.ink,
                }}
                allowFontScaling
              >
                {detail.title}
              </Text>
              <Text
                style={{
                  fontFamily: theme.fonts.body,
                  color: theme.colors.inkMuted,
                  fontSize: theme.typography.caption.fontSize,
                }}
              >
                {[dueLabel, detail.categoryName].filter(Boolean).join(' · ')}
              </Text>
              <Text
                style={{
                  fontFamily: theme.fonts.label,
                  color: theme.colors.inkSubtle,
                  fontSize: theme.typography.label.fontSize,
                }}
              >
                {copy.progress
                  .replace('{done}', String(completed))
                  .replace('{total}', String(total))}
                {detail.blocked ? ` · ${detail.blocked} blocked` : ''}
                {detail.notApplicable
                  ? ` · ${detail.notApplicable} N/A`
                  : ''}
              </Text>
            </View>
            {countdown?.shortLabel ? (
              <DueCountdownRing
                shortLabel={countdown.shortLabel}
                progress={countdown.progress}
                urgency={countdown.urgency}
                size={52}
              />
            ) : null}
          </View>

          {sections.length === 0 ? (
            <Text
              style={{
                fontFamily: theme.fonts.body,
                color: theme.colors.inkMuted,
                fontSize: theme.typography.body.fontSize,
              }}
              allowFontScaling
            >
              {copy.emptyItems}
            </Text>
          ) : null}

          {sections.map((section) => (
            <View key={section.title ?? '__none'} style={{ gap: theme.space.xs }}>
              {section.title ? (
                <Text
                  style={{
                    fontFamily: theme.fonts.label,
                    color: theme.colors.inkSubtle,
                    textTransform: 'uppercase',
                    letterSpacing: 0.5,
                    marginTop: theme.space.sm,
                  }}
                >
                  {section.title}
                </Text>
              ) : null}
              {section.items.map((item) => (
                <RunChecklistItem
                  key={item.id}
                  item={item}
                  busy={busyId === item.id}
                  instructionsOpen={Boolean(expanded[item.id])}
                  onToggleDone={() => void toggleDone(item)}
                  onNotApplicable={() =>
                    openOutcomeModal(item, 'not_applicable')
                  }
                  onBlocked={() => openOutcomeModal(item, 'blocked')}
                  onToggleInstructions={() =>
                    setExpanded((s) => ({ ...s, [item.id]: !s[item.id] }))
                  }
                  onResolveIssue={
                    item.issueId && item.issueState === 'open'
                      ? () => {
                          setNote('');
                          setModal({
                            kind: 'resolve',
                            issueId: item.issueId!,
                          });
                        }
                      : undefined
                  }
                />
              ))}
            </View>
          ))}
        </ScrollView>
      </View>

      <Modal visible={modal != null} transparent animationType="fade">
        <View
          style={{
            flex: 1,
            backgroundColor: theme.colors.overlay,
            justifyContent: 'flex-end',
          }}
        >
          <View
            style={{
              backgroundColor: theme.colors.canvas,
              borderTopLeftRadius: theme.radii.lg,
              borderTopRightRadius: theme.radii.lg,
              padding: theme.space.lg,
              gap: theme.space.md,
            }}
          >
            <Text
              style={{
                fontFamily: theme.fonts.display,
                fontSize: theme.typography.heading.fontSize,
                color: theme.colors.ink,
              }}
            >
              {modal?.kind === 'resolve'
                ? copy.resolveIssue
                : copy.exceptionTitle}
            </Text>
            <TextInput
              value={note}
              onChangeText={setNote}
              placeholder={
                modal?.kind === 'resolve'
                  ? copy.resolveNote
                  : modal?.kind === 'outcome' && modal.requireNote
                    ? copy.noteRequired
                    : copy.noteOptional
              }
              placeholderTextColor={theme.colors.inkSubtle}
              multiline
              style={{
                minHeight: 96,
                borderWidth: 1,
                borderColor: theme.colors.border,
                borderRadius: theme.radii.sm,
                padding: theme.space.md,
                fontFamily: theme.fonts.body,
                color: theme.colors.ink,
                backgroundColor: theme.colors.white,
                textAlignVertical: 'top',
              }}
            />
            <View style={{ flexDirection: 'row', gap: theme.space.sm }}>
              <Button
                label={t().common.cancel}
                variant="secondary"
                onPress={() => setModal(null)}
                style={{ flex: 1 }}
              />
              <Button
                label={copy.exceptionSave}
                onPress={() => void confirmModal()}
                style={{ flex: 1 }}
              />
            </View>
          </View>
        </View>
      </Modal>
    </Screen>
  );
}
