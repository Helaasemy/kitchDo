import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  Text,
  View,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';

import { Button, Screen, TextField } from '@/components/ui';
import { useTheme } from '@/design';
import { getTemplate, type TemplateDetail } from '@/features/templates/api';
import {
  listActiveSchedulesForTemplate,
  pauseSchedule,
  reviseSchedule,
  type Schedule,
  type Weekday,
} from '@/features/schedules/api';
import { goBackOr } from '@/lib/navigation';
import { useT } from '@/i18n';

export default function TemplateScheduleScreen() {
  const t = useT();
  const theme = useTheme();
  const weekdaysCopy: { value: Weekday; label: string }[] = [
    { value: 1, label: t().schedules.weekdayMon },
    { value: 2, label: t().schedules.weekdayTue },
    { value: 3, label: t().schedules.weekdayWed },
    { value: 4, label: t().schedules.weekdayThu },
    { value: 5, label: t().schedules.weekdayFri },
    { value: 6, label: t().schedules.weekdaySat },
    { value: 7, label: t().schedules.weekdaySun },
  ];
  const { id } = useLocalSearchParams<{ id: string }>();
  const templateId = String(id);
  const copy = t().schedules;
  const tmplCopy = t().templates;

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [published, setPublished] = useState(false);
  const [active, setActive] = useState<Schedule | null>(null);

  const [weekdays, setWeekdays] = useState<Weekday[]>([1, 2, 3, 4, 5]);
  const [startTime, setStartTime] = useState('08:30');
  const [dueAfter, setDueAfter] = useState('60');
  const [reminderEnabled, setReminderEnabled] = useState(false);
  const [reminderLead, setReminderLead] = useState('15');

  const applyLoaded = ([detail, schedules]: [TemplateDetail | null, Schedule[]]) => {
    setPublished(Boolean(detail?.publishedRevision));
    const current = schedules[0] ?? null;
    setActive(current);
    if (current) {
      setWeekdays(current.weekdays);
      setStartTime(current.localStartTime.slice(0, 5));
      setDueAfter(String(current.dueAfterMinutes));
      setReminderEnabled(current.reminderEnabled);
      setReminderLead(String(current.reminderLeadMinutes || 15));
    }
  };

  const fetchData = useCallback(
    () => Promise.all([getTemplate(templateId), listActiveSchedulesForTemplate(templateId)]),
    [templateId],
  );

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      applyLoaded(await fetchData());
    } catch (e) {
      setError(e instanceof Error ? e.message : t().common.errorGeneric);
    } finally {
      setLoading(false);
    }
  }, [fetchData, t]);

  useEffect(() => {
    let cancelled = false;
    fetchData()
      .then((data) => {
        if (!cancelled) applyLoaded(data);
      })
      .catch((e: unknown) => {
        if (!cancelled) setError(e instanceof Error ? e.message : t().common.errorGeneric);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [fetchData, t]);

  const toggleDay = (day: Weekday) => {
    setWeekdays((prev) =>
      prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day].sort(),
    );
  };

  const onSave = async () => {
    if (!published) {
      setError(copy.needPublish);
      return;
    }
    const minutes = Number.parseInt(dueAfter, 10);
    const lead = Number.parseInt(reminderLead, 10);
    setSaving(true);
    setError(null);
    try {
      await reviseSchedule({
        templateId,
        seriesId: active?.seriesId,
        weekdays,
        localStartTime: startTime,
        dueAfterMinutes: minutes,
        reminderEnabled,
        reminderLeadMinutes: Number.isFinite(lead) ? lead : 0,
      });
      await load();
      Alert.alert(t().common.done, undefined, [
        {
          text: t().common.done,
          onPress: () => goBackOr(`/(app)/(tabs)/templates/${templateId}/hub`),
        },
      ]);
    } catch (e) {
      setError(e instanceof Error ? e.message : t().common.errorGeneric);
    } finally {
      setSaving(false);
    }
  };

  const onPause = () => {
    if (!active) return;
    Alert.alert(copy.pause, undefined, [
      { text: t().common.cancel, style: 'cancel' },
      {
        text: copy.pause,
        style: 'destructive',
        onPress: async () => {
          setSaving(true);
          try {
            await pauseSchedule({ seriesId: active.seriesId });
            await load();
          } catch (e) {
            setError(e instanceof Error ? e.message : t().common.errorGeneric);
          } finally {
            setSaving(false);
          }
        },
      },
    ]);
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
            onPress={() =>
              goBackOr(`/(app)/(tabs)/templates/${templateId}/hub`)
            }
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
              fontFamily: theme.fonts.display,
              fontSize: theme.typography.title.fontSize,
              color: theme.colors.ink,
            }}
            allowFontScaling
          >
            {copy.title}
          </Text>
          <View style={{ width: 48 }} />
        </View>

        <Text
          style={{
            fontFamily: theme.fonts.body,
            fontSize: theme.typography.body.fontSize,
            color: theme.colors.inkMuted,
            lineHeight: theme.typography.body.lineHeight,
          }}
          allowFontScaling
        >
          {copy.subtitle}
        </Text>

        {!published ? (
          <Text
            style={{
              fontFamily: theme.fonts.body,
              color: theme.colors.coral,
              fontSize: theme.typography.caption.fontSize,
            }}
            allowFontScaling
          >
            {copy.needPublish}
          </Text>
        ) : null}

        <Text
          style={{
            fontFamily: theme.fonts.label,
            fontSize: theme.typography.label.fontSize,
            color: theme.colors.inkSubtle,
            textTransform: 'uppercase',
            letterSpacing: 0.6,
          }}
          allowFontScaling
        >
          {copy.weekdays}
        </Text>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: theme.space.sm }}>
          {weekdaysCopy.map((day) => {
            const selected = weekdays.includes(day.value);
            return (
              <Pressable
                key={day.value}
                onPress={() => toggleDay(day.value)}
                style={{
                  minWidth: 44,
                  paddingVertical: theme.space.sm,
                  paddingHorizontal: theme.space.md,
                  borderRadius: theme.radii.sm,
                  borderWidth: 1,
                  borderColor: selected
                    ? theme.colors.primary
                    : theme.colors.border,
                  backgroundColor: selected
                    ? theme.colors.sand
                    : theme.colors.white,
                  alignItems: 'center',
                }}
              >
                <Text
                  style={{
                    fontFamily: theme.fonts.bodyMedium,
                    color: selected ? theme.colors.primary : theme.colors.inkMuted,
                  }}
                  allowFontScaling
                >
                  {day.label}
                </Text>
              </Pressable>
            );
          })}
        </View>

        <TextField
          label={copy.startTime}
          value={startTime}
          onChangeText={setStartTime}
          placeholder={copy.startTimePlaceholder}
          keyboardType="numbers-and-punctuation"
          autoCapitalize="none"
        />
        <TextField
          label={copy.dueAfter}
          value={dueAfter}
          onChangeText={setDueAfter}
          keyboardType="number-pad"
        />

        <Pressable
          onPress={() => setReminderEnabled((v) => !v)}
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: theme.space.md,
            padding: theme.space.md,
            borderRadius: theme.radii.sm,
            borderWidth: 1,
            borderColor: theme.colors.border,
            backgroundColor: theme.colors.white,
          }}
        >
          <View
            style={{
              width: 22,
              height: 22,
              borderRadius: 6,
              borderWidth: 1.5,
              borderColor: reminderEnabled
                ? theme.colors.primary
                : theme.colors.borderStrong,
              backgroundColor: reminderEnabled
                ? theme.colors.primary
                : 'transparent',
            }}
          />
          <Text
            style={{
              fontFamily: theme.fonts.bodyMedium,
              color: theme.colors.ink,
              flex: 1,
            }}
            allowFontScaling
          >
            {copy.reminder}
          </Text>
        </Pressable>

        {reminderEnabled ? (
          <TextField
            label={copy.reminderLead}
            value={reminderLead}
            onChangeText={setReminderLead}
            keyboardType="number-pad"
          />
        ) : null}

        {active ? (
          <Text
            style={{
              fontFamily: theme.fonts.body,
              color: theme.colors.inkMuted,
              fontSize: theme.typography.caption.fontSize,
            }}
            allowFontScaling
          >
            {copy.activeLabel}: {active.localStartTime.slice(0, 5)}
          </Text>
        ) : (
          <Text
            style={{
              fontFamily: theme.fonts.body,
              color: theme.colors.inkSubtle,
              fontSize: theme.typography.caption.fontSize,
            }}
            allowFontScaling
          >
            {copy.noneYet}
          </Text>
        )}

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

        <Button
          label={copy.save}
          loading={saving}
          disabled={!published}
          onPress={() => void onSave()}
        />
        {active ? (
          <Button
            label={copy.pause}
            variant="secondary"
            loading={saving}
            onPress={onPause}
          />
        ) : null}
        <Button
          label={tmplCopy.returnToList}
          variant="ghost"
          onPress={() => router.replace('/(app)/(tabs)/templates')}
        />
      </View>
    </Screen>
  );
}
