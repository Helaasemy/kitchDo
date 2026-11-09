import { useCallback, useRef, useState } from 'react';
import { Linking, ScrollView, Text, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';

import { Button, EmptyState, Screen, ScreenHeader, SectionLabel } from '@/components/ui';
import { useTheme } from '@/design';
import { useAuth } from '@/features/auth';
import {
  addPresetToTemplates,
  findUneditedCopy,
  getCategory,
  getPreset,
  groupLabel,
  presetTaskCount,
} from '@/features/catalog';
import { CatalogBackLink } from '@/features/catalog/components';
import { t } from '@/i18n';

/** Preview of a bundled preset; Use saves and publishes a copy in one step. */
export default function CatalogPresetScreen() {
  const theme = useTheme();
  const { presetId } = useLocalSearchParams<{ presetId: string }>();
  const preset = getPreset(String(presetId));
  const copy = t().catalog;
  const { user, kitchenId } = useAuth();
  const userId = user?.id;
  const adding = useRef(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copyId, setCopyId] = useState<string | null>(null);

  useFocusEffect(
    useCallback(() => {
      if (!userId || !kitchenId || !preset) return;
      findUneditedCopy(userId, kitchenId, preset.id)
        .then((found) => setCopyId(found?.templateId ?? null))
        .catch(() => setCopyId(null));
    }, [userId, kitchenId, preset]),
  );

  if (!preset) {
    return (
      <Screen>
        <CatalogBackLink />
        <EmptyState title={copy.title} body={copy.notFound} />
      </Screen>
    );
  }

  const category = getCategory(preset.category);

  const onUse = async () => {
    if (adding.current || copyId) return;
    if (!userId || !kitchenId) {
      setError(t().templates.needKitchen);
      return;
    }
    adding.current = true;
    setBusy(true);
    setError(null);
    try {
      const { templateId } = await addPresetToTemplates({ userId, kitchenId, preset });
      setCopyId(templateId);
      router.push(`/(app)/(tabs)/templates/${templateId}/hub`);
    } catch (e) {
      setError(e instanceof Error ? e.message : t().common.errorGeneric);
    } finally {
      adding.current = false;
      setBusy(false);
    }
  };

  const bodyText = {
    fontFamily: theme.fonts.body,
    fontSize: theme.typography.body.fontSize,
    lineHeight: theme.typography.body.lineHeight,
    color: theme.colors.ink,
  } as const;

  const captionText = {
    fontFamily: theme.fonts.body,
    fontSize: theme.typography.caption.fontSize,
    lineHeight: theme.typography.caption.lineHeight,
    color: theme.colors.inkMuted,
  } as const;

  const card = {
    padding: theme.space.md,
    borderRadius: theme.radii.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.white,
    gap: theme.space.sm,
  } as const;

  const sectionOffsets = preset.sections.map((_, index) =>
    preset.sections.slice(0, index).reduce((n, s) => n + s.tasks.length, 0),
  );

  return (
    <Screen>
      <View style={{ flex: 1 }}>
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={{ gap: theme.space.lg, paddingBottom: theme.space.lg }}
          showsVerticalScrollIndicator={false}
        >
          <View style={{ gap: 10 }}>
            <CatalogBackLink />
            <ScreenHeader
              eyebrow={`${category.label} · ${groupLabel(preset.group)}`}
              title={preset.title}
            />
          </View>

          <View style={card}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.space.sm }}>
              <Ionicons name="repeat-outline" size={18} color={theme.colors.primary} />
              <Text style={[bodyText, { fontFamily: theme.fonts.bodySemiBold }]} allowFontScaling>
                {copy.suggestedCadence}: {preset.cadence}
              </Text>
            </View>
            <Text style={captionText} allowFontScaling>
              {copy.startsAs.replace(
                '{frequency}',
                preset.frequency
                  ? t().recurring[preset.frequency]
                  : t().recurring.oneOff,
              )}
              . {copy.cadenceHint}
            </Text>
          </View>

          {category.guidance ? (
            <View style={{ flexDirection: 'row', gap: theme.space.sm }}>
              <Ionicons
                name="information-circle-outline"
                size={18}
                color={theme.colors.inkMuted}
              />
              <Text style={[captionText, { flex: 1 }]} allowFontScaling>
                {category.guidance}
              </Text>
            </View>
          ) : null}

          <View style={{ gap: theme.space.md }}>
            <SectionLabel>
              {`${copy.checklistTitle} · ${copy.taskCount.replace(
                '{count}',
                String(presetTaskCount(preset)),
              )}`}
            </SectionLabel>
            {preset.sections.map((section, sIndex) => (
              <View key={`${sIndex}-${section.title ?? ''}`} style={card}>
                {section.title ? (
                  <Text
                    style={{
                      fontFamily: theme.fonts.displayRegular,
                      fontSize: theme.typography.body.fontSize,
                      lineHeight: theme.typography.body.lineHeight,
                      color: theme.colors.ink,
                    }}
                    allowFontScaling
                  >
                    {section.title}
                  </Text>
                ) : null}
                {section.tasks.map((task, tIndex) => {
                  const step = sectionOffsets[sIndex] + tIndex + 1;
                  return (
                    <View key={`${step}`} style={{ flexDirection: 'row', gap: theme.space.sm }}>
                      <Text
                        style={[captionText, { width: 24, textAlign: 'right', lineHeight: theme.typography.body.lineHeight }]}
                        allowFontScaling
                      >
                        {step}.
                      </Text>
                      <Text style={[bodyText, { flex: 1 }]} allowFontScaling>
                        {task}
                      </Text>
                    </View>
                  );
                })}
              </View>
            ))}
          </View>

          {preset.notes.length > 0 ? (
            <View style={{ gap: theme.space.sm }}>
              <SectionLabel>{copy.notesTitle}</SectionLabel>
              {preset.notes.map((note, index) => (
                <View key={index} style={card}>
                  {note.text ? (
                    <Text style={bodyText} allowFontScaling>
                      {note.text}
                    </Text>
                  ) : null}
                  {note.links.map((link) => (
                    <Text
                      key={link.url}
                      accessibilityRole="link"
                      onPress={() => void Linking.openURL(link.url)}
                      style={[bodyText, { color: theme.colors.primary, textDecorationLine: 'underline' }]}
                      allowFontScaling
                    >
                      {link.label}
                    </Text>
                  ))}
                </View>
              ))}
            </View>
          ) : null}
        </ScrollView>

        <View style={{ gap: theme.space.xs, paddingVertical: theme.space.md }}>
          {error ? (
            <Text
              style={[captionText, { color: theme.colors.coral, textAlign: 'center' }]}
              allowFontScaling
            >
              {error}
            </Text>
          ) : null}
          <Button
            label={copyId ? copy.alreadyAdded : copy.useTemplate}
            loading={busy}
            disabled={Boolean(copyId)}
            onPress={() => void onUse()}
          />
          <Text style={[captionText, { textAlign: 'center' }]} allowFontScaling>
            {copyId ? copy.alreadyAddedHint : copy.useTemplateHint}
          </Text>
          {copyId ? (
            <Button
              label={copy.openCopy}
              variant="ghost"
              onPress={() => router.push(`/(app)/(tabs)/templates/${copyId}/hub`)}
            />
          ) : null}
        </View>
      </View>
    </Screen>
  );
}
