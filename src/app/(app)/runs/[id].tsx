import { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  ScrollView,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { DateTime } from 'luxon';

import {
  BackLink,
  Button,
  IconButton,
  Screen,
  ScreenHeader,
  SectionChip,
  SyncBanner,
} from '@/components/ui';
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
import { getDeviceTimeZone } from '@/lib/dates';
import { goBackOr } from '@/lib/navigation';
import { useT } from '@/i18n';

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
  const t = useT();
  const theme = useTheme();
  const params = useLocalSearchParams<{ id: string | string[] }>();
  const runId = Array.isArray(params.id) ? params.id[0] : params.id;
  const { user, kitchenId, canComplete } = useAuth();
  const insets = useSafeAreaInsets();
  const copy = t().runs;

  const [detail, setDetail] = useState<RunDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [modal, setModal] = useState<NoteModal>(null);
  const [note, setNote] = useState('');

  const load = useCallback(async () => {
    if (!user?.id || !runId) return;
    setLoading(true);
    try {
      setDetail(await getRunDetail(user.id, runId));
    } finally {
      setLoading(false);
    }
  }, [user?.id, runId]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

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
    if (!canComplete) {
      Alert.alert(t().invite.cannotComplete);
      return;
    }
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
    if (!canComplete) {
      Alert.alert(t().invite.cannotComplete);
      return;
    }
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
    if (!canComplete) {
      Alert.alert(t().invite.cannotComplete);
      return;
    }
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
        <View style={{ gap: theme.space.md }}>
          <BackLink fallback="/(app)/(tabs)/today" />
          <Text
            style={{
              fontFamily: theme.fonts.bodyMedium,
              fontSize: theme.typography.body.fontSize,
              color: theme.colors.inkMuted,
            }}
            allowFontScaling
          >
            {copy.missingRun}
          </Text>
        </View>
      </Screen>
    );
  }

  const total = detail.done + detail.notApplicable + detail.blocked + detail.pending;
  const completed = detail.done + detail.notApplicable + detail.blocked;
  const finished = detail.state === 'finished';
  const ratio = total > 0 ? completed / total : 0;
  const stateText = finished
    ? copy.finished
    : detail.state === 'in_progress'
      ? copy.inProgress
      : copy.notStarted;
  const summary = [
    copy.doneSummary,
    detail.blocked ? copy.blockedCount.replace('{count}', String(detail.blocked)) : null,
    detail.notApplicable
      ? copy.naCount.replace('{count}', String(detail.notApplicable))
      : null,
  ]
    .filter(Boolean)
    .join(' · ');
  const eyebrow = [copy.eyebrow, dueLabel, detail.categoryName].filter(Boolean).join(' · ');

  return (
    <Screen>
      <View style={{ flex: 1, gap: theme.space.md }}>
        <View
          style={{
            flexDirection: 'row',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <IconButton
            name="chevron-back"
            accessibilityLabel={t().common.back}
            onPress={() => goBackOr()}
          />
          <SectionChip
            label={stateText}
            chipTone={
              finished
                ? {
                    background: theme.colors.frequency.monthly.tint,
                    text: theme.colors.frequency.monthly.text,
                    dot: theme.colors.frequency.monthly.base,
                  }
                : undefined
            }
          />
        </View>

        <SyncBanner />

        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{
            gap: theme.space.xxl,
            paddingTop: theme.space.sm,
            paddingBottom: theme.space.xxxl,
          }}
        >
          <View style={{ gap: theme.space.sm }}>
            <ScreenHeader size="display" eyebrow={eyebrow} title={detail.title} />
            {!canComplete ? (
              <Text
                style={{
                  fontFamily: theme.fonts.bodyMedium,
                  color: theme.colors.inkMuted,
                  fontSize: theme.typography.caption.fontSize,
                }}
                allowFontScaling
              >
                {t().invite.cannotComplete}
              </Text>
            ) : null}
            {detail.pendingCreate ? (
              <Text
                style={{
                  fontFamily: theme.fonts.bodyMedium,
                  color: theme.colors.inkMuted,
                  fontSize: theme.typography.caption.fontSize,
                }}
                allowFontScaling
              >
                {t().sync.syncing}
              </Text>
            ) : null}
          </View>

          <View
            accessible
            accessibilityLabel={`${copy.progress
              .replace('{done}', String(completed))
              .replace('{total}', String(total))} ${summary}`}
            style={{
              gap: theme.space.lg,
              padding: theme.space.xl,
              borderRadius: theme.radii.xxl,
              backgroundColor: theme.colors.white,
              boxShadow: theme.shadows.raised,
            }}
          >
            <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: theme.space.sm }}>
              <Text
                style={{
                  fontFamily: theme.fonts.bodyExtraBold,
                  fontSize: 32,
                  lineHeight: 36,
                  color: theme.colors.ink,
                }}
                allowFontScaling
              >
                {copy.progress
                  .replace('{done}', String(completed))
                  .replace('{total}', String(total))}
              </Text>
              <Text
                style={{
                  flex: 1,
                  fontFamily: theme.fonts.bodySemiBold,
                  fontSize: theme.typography.bodySmall.fontSize,
                  lineHeight: 20,
                  marginBottom: 4,
                  color: theme.colors.inkMuted,
                }}
                allowFontScaling
              >
                {summary}
              </Text>
            </View>
            <View
              style={{
                height: 10,
                borderRadius: 5,
                backgroundColor: theme.colors.sand,
                overflow: 'hidden',
              }}
            >
              <View
                style={{
                  width: `${Math.round(ratio * 100)}%`,
                  height: '100%',
                  borderRadius: 5,
                  backgroundColor: finished
                    ? theme.colors.frequency.monthly.base
                    : theme.colors.primary,
                }}
              />
            </View>
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
            <View key={section.title ?? '__none'} style={{ gap: theme.space.lg }}>
              {section.title ? <SectionChip label={section.title} /> : null}
              <View
                style={{
                  borderRadius: theme.radii.xxl,
                  borderWidth: 0.5,
                  borderColor: theme.colors.border,
                  backgroundColor: theme.colors.white,
                  boxShadow: theme.shadows.soft,
                  overflow: 'hidden',
                }}
              >
                {section.items.map((item, index) => (
                  <RunChecklistItem
                    key={item.id}
                    item={item}
                    busy={busyId === item.id}
                    divider={index < section.items.length - 1}
                    instructionsOpen={Boolean(expanded[item.id])}
                    onToggleDone={() => void toggleDone(item)}
                    onNotApplicable={() => openOutcomeModal(item, 'not_applicable')}
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
            </View>
          ))}
        </ScrollView>

        <View
          style={{
            paddingTop: theme.space.sm,
            paddingBottom: Math.max(insets.bottom, theme.space.lg),
          }}
        >
          <Button label={copy.close} onPress={() => goBackOr()} />
        </View>
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
              borderTopLeftRadius: theme.radii.xxl,
              borderTopRightRadius: theme.radii.xxl,
              padding: theme.space.xl,
              paddingBottom: theme.space.xxl,
              gap: theme.space.lg,
            }}
          >
            <Text
              style={{
                fontFamily: theme.fonts.display,
                fontSize: 28,
                lineHeight: 32,
                color: theme.colors.ink,
              }}
              allowFontScaling
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
                borderRadius: theme.radii.xl,
                padding: theme.space.lg,
                fontFamily: theme.fonts.body,
                fontSize: theme.typography.body.fontSize,
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
