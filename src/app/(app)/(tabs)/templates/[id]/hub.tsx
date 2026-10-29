import { useCallback, useState } from 'react';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';

import { Button, Screen } from '@/components/ui';
import { useTheme } from '@/design';
import { useAuth } from '@/features/auth';
import {
  findOpenRunForTemplate,
  startManualRunFromTemplate,
} from '@/features/runs';
import { getTemplate, type TemplateDetail } from '@/features/templates/api';
import { goBackOr } from '@/lib/navigation';
import { t } from '@/i18n';

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
  const copy = t().templates;

  const [loading, setLoading] = useState(true);
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [detail, setDetail] = useState<TemplateDetail | null>(null);
  const [openRunId, setOpenRunId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const tmpl = await getTemplate(templateId);
      setDetail(tmpl);
      if (!tmpl) {
        setError(t().common.errorGeneric);
        setOpenRunId(null);
        return;
      }

      if (user?.id && kitchenId) {
        const open = await findOpenRunForTemplate(
          user.id,
          kitchenId,
          templateId,
        );
        setOpenRunId(open?.runId ?? null);
      } else {
        setOpenRunId(null);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : t().common.errorGeneric);
    } finally {
      setLoading(false);
    }
  }, [templateId, user?.id, kitchenId]);

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
          <Button
            label={copy.addSchedule}
            variant="secondary"
            onPress={() =>
              router.push(`/(app)/(tabs)/templates/${templateId}/schedule`)
            }
          />
        </View>
      </View>
    </Screen>
  );
}
