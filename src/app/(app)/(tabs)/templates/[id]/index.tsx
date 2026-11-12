import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
import Ionicons from '@expo/vector-icons/Ionicons';
import * as Haptics from 'expo-haptics';
import { router, useLocalSearchParams } from 'expo-router';
import DraggableFlatList, {
  ScaleDecorator,
  type RenderItemParams,
} from 'react-native-draggable-flatlist';

import { Button, NetworkRequiredBanner, Screen, TextField } from '@/components/ui';
import { useTheme } from '@/design';
import { useAuth } from '@/features/auth';
import { isListLimitError, usePlanPaywall } from '@/features/billing';
import { useSync } from '@/lib/sync';
import { listCategories, type Category } from '@/features/categories/api';
import {
  findOpenRunForTemplate,
  startManualRunFromTemplate,
} from '@/features/runs';
import {
  archiveTemplate,
  duplicateTemplate,
  getTemplate,
  parsePastedItems,
  publishTemplate,
  saveTemplateDraft,
  type TemplateItemInput,
  type TemplateSectionInput,
} from '@/features/templates/api';
import {
  forgetTemplateSource,
  isLibraryCopy,
  noteTemplateSaved,
  templateSignature,
} from '@/features/catalog';
import {
  clearTemplateFrequencies,
  copyTemplateFrequencies,
  getTemplateFrequencies,
  saveTemplateFrequencies,
  TASK_FREQUENCIES,
  type TaskFrequency,
} from '@/features/recurring';
import { newId } from '@/lib/ids';
import { goBackOr, routeParam } from '@/lib/navigation';
import { useT } from '@/i18n';

type DraftItem = {
  key: string;
  id: string;
  sectionId: string | null;
  title: string;
  instructions: string;
  /** `null` = one-off, done with Use now. */
  frequency: TaskFrequency | null;
};

type DraftSection = {
  key: string;
  id: string;
  title: string;
};

type AfterAction = 'saved' | 'published' | null;

export default function TemplateBuilderScreen() {
  const t = useT();
  const theme = useTheme();
  const { id } = useLocalSearchParams<{ id: string | string[] }>();
  const templateId = routeParam(id);
  const { kitchenId, user, canEditTemplates } = useAuth();
  const { paywall, openLists } = usePlanPaywall();
  const userId = user?.id;
  const { status: syncStatus } = useSync();
  const copy = t().templates;
  const recurringCopy = t().recurring;

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [exists, setExists] = useState(false);
  const [revision, setRevision] = useState(0);
  const [state, setState] = useState<'draft' | 'active' | 'archived'>('draft');
  const [publishedRevision, setPublishedRevision] = useState<number | null>(null);

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [sections, setSections] = useState<DraftSection[]>([]);
  const [items, setItems] = useState<DraftItem[]>([]);

  const [pasteOpen, setPasteOpen] = useState(false);
  const [pasteRaw, setPasteRaw] = useState('');
  const [afterAction, setAfterAction] = useState<AfterAction>(null);
  const [afterOpenRunId, setAfterOpenRunId] = useState<string | null>(null);
  const [libraryCopy, setLibraryCopy] = useState(false);

  const readOnly = state === 'archived' || !canEditTemplates;
  const alreadyUsed = publishedRevision != null;

  const loadKey = `${kitchenId}:${templateId}:${userId}`;
  const [loadedKey, setLoadedKey] = useState(loadKey);
  if (loadedKey !== loadKey) {
    setLoadedKey(loadKey);
    setLoading(true);
    setError(null);
  }

  useEffect(() => {
    if (!kitchenId || !templateId) return;
    let cancelled = false;
    Promise.all([
      listCategories(kitchenId),
      getTemplate(templateId),
      userId
        ? getTemplateFrequencies(userId, kitchenId, templateId)
        : Promise.resolve({} as Record<string, TaskFrequency>),
      userId ? isLibraryCopy(userId, kitchenId, templateId) : Promise.resolve(false),
    ])
      .then(([cats, detail, frequencies, fromLibrary]) => {
        if (cancelled) return;
        setLibraryCopy(fromLibrary);
        setCategories(cats);
        if (detail) {
          setExists(true);
          setTitle(detail.title);
          setDescription(detail.description ?? '');
          setCategoryId(detail.categoryId);
          setRevision(detail.revision);
          setState(detail.state);
          setPublishedRevision(detail.publishedRevision);
          setSections(
            detail.sections.map((s) => ({
              key: s.id,
              id: s.id,
              title: s.title,
            })),
          );
          setItems(
            detail.items.map((i) => ({
              key: i.id,
              id: i.id,
              sectionId: i.sectionId,
              title: i.title,
              instructions: i.instructions ?? '',
              frequency: frequencies[i.id] ?? null,
            })),
          );
        } else {
          setExists(false);
          setRevision(0);
          setState('draft');
          setPublishedRevision(null);
        }
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
  }, [kitchenId, templateId, userId, t]);

  const pastePreview = useMemo(() => parsePastedItems(pasteRaw), [pasteRaw]);

  const buildPayload = (): {
    sections: TemplateSectionInput[];
    items: TemplateItemInput[];
  } => {
    const sectionPayload = sections.map((s, index) => ({
      id: s.id,
      title: s.title.trim() || `Section ${index + 1}`,
      sort_order: index,
    }));
    const itemPayload = items
      .filter((i) => i.title.trim())
      .map((i, index) => ({
        id: i.id,
        section_id: i.sectionId,
        title: i.title.trim(),
        instructions: i.instructions.trim() || null,
        sort_order: index,
      }));
    return { sections: sectionPayload, items: itemPayload };
  };

  const persistDraft = async (): Promise<number> => {
    if (!kitchenId || !templateId) throw new Error(copy.needKitchen);
    if (!title.trim()) throw new Error(copy.needTitle);
    const payload = buildPayload();
    const result = await saveTemplateDraft({
      templateId,
      kitchenId,
      expectedRevision: exists ? revision : 0,
      title,
      description,
      categoryId,
      sections: payload.sections,
      items: payload.items,
    });
    setExists(true);
    setRevision(result.revision);
    setState((prev) => (prev === 'archived' ? prev : prev === 'active' ? 'active' : 'draft'));
    if (userId) {
      const sectionTitles = new Map(payload.sections.map((s) => [s.id, s.title]));
      const frequencyById = new Map(items.map((i) => [i.id, i.frequency]));
      await saveTemplateFrequencies({
        userId,
        kitchenId,
        templateId,
        templateTitle: title.trim(),
        tasks: payload.items.map((i) => ({
          itemId: i.id,
          frequency: frequencyById.get(i.id) ?? null,
          title: i.title,
          sectionTitle: i.section_id ? (sectionTitles.get(i.section_id) ?? null) : null,
          sortOrder: i.sort_order,
        })),
      });
      await noteTemplateSaved(
        userId,
        kitchenId,
        templateId,
        templateSignature({
          title,
          sections: payload.sections,
          items: payload.items.map((i) => ({
            sectionId: i.section_id,
            title: i.title,
            frequency: frequencyById.get(i.id) ?? null,
          })),
        }),
      );
    }
    return result.revision;
  };

  const resolveAfterOpenRun = async () => {
    if (!user?.id || !kitchenId || !templateId) {
      setAfterOpenRunId(null);
      return;
    }
    const open = await findOpenRunForTemplate(
      user.id,
      kitchenId,
      templateId,
    );
    setAfterOpenRunId(open?.runId ?? null);
  };

  const commitSaveDraft = async () => {
    await persistDraft();
    await resolveAfterOpenRun();
    setAfterAction('saved');
  };

  const commitPublish = async () => {
    if (!templateId) throw new Error(copy.needKitchen);
    const payload = buildPayload();
    if (payload.items.length === 0) {
      throw new Error(copy.needItems);
    }
    const nextRevision = await persistDraft();
    const published = await publishTemplate({
      templateId,
      expectedRevision: nextRevision,
    });
    setRevision(published.revision);
    setPublishedRevision(published.publishedRevision);
    setState('active');
    await resolveAfterOpenRun();
    setAfterAction('published');
  };

  /** `saving` state lags a frame; the ref blocks a second tap creating a duplicate. */
  const savingRef = useRef(false);
  const runSave = async (task: () => Promise<void>) => {
    if (savingRef.current) return;
    savingRef.current = true;
    setSaving(true);
    setError(null);
    try {
      await task();
    } catch (e) {
      const raw = e instanceof Error ? e.message : t().common.errorGeneric;
      if (isListLimitError(raw)) {
        openLists();
        setError(t().billing.listLimit);
      } else {
        setError(raw);
      }
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  };

  const onSaveDraft = () => runSave(commitSaveDraft);

  const onPublish = async () => {
    const payload = buildPayload();
    if (payload.items.length === 0) {
      setError(copy.needItems);
      return;
    }
    await runSave(commitPublish);
  };

  /** For templates already in use: always save draft + publish this template. */
  const onSaveChanges = async () => {
    const payload = buildPayload();
    if (!title.trim()) {
      setError(copy.needTitle);
      return;
    }
    if (payload.items.length === 0) {
      setError(copy.needItems);
      return;
    }
    await runSave(commitPublish);
  };

  const onDuplicate = async () => {
    if (!templateId) return;
    setSaving(true);
    try {
      if (!exists) await persistDraft();
      const dup = await duplicateTemplate(templateId);
      if (userId && kitchenId) {
        await copyTemplateFrequencies({
          userId,
          kitchenId,
          fromTemplateId: templateId,
          toTemplateId: dup.templateId,
        }).catch(() => undefined);
      }
      router.replace(`/(app)/(tabs)/templates/${dup.templateId}`);
    } catch (e) {
      const raw = e instanceof Error ? e.message : t().common.errorGeneric;
      if (isListLimitError(raw)) {
        openLists();
        setError(t().billing.listLimit);
      } else {
        setError(raw);
      }
    } finally {
      setSaving(false);
    }
  };

  const onArchive = () => {
    Alert.alert(copy.archive, undefined, [
      { text: t().common.cancel, style: 'cancel' },
      {
        text: copy.archive,
        style: 'destructive',
        onPress: async () => {
          if (!templateId) return;
          setSaving(true);
          try {
            await archiveTemplate({
              templateId,
              expectedRevision: revision,
            });
            if (userId && kitchenId) {
              await clearTemplateFrequencies(userId, kitchenId, templateId);
              await forgetTemplateSource(userId, kitchenId, templateId);
            }
            router.replace('/(app)/(tabs)/templates');
          } catch (e) {
            setError(e instanceof Error ? e.message : t().common.errorGeneric);
          } finally {
            setSaving(false);
          }
        },
      },
    ]);
  };

  const onUseNow = async () => {
    if (!kitchenId || !user?.id || !templateId) {
      setError(copy.needKitchen);
      return;
    }
    setSaving(true);
    setError(null);
    try {
      // Reuses the unfinished run when one exists — never starts a second copy.
      const { runId } = await startManualRunFromTemplate({
        userId: user.id,
        kitchenId,
        templateId,
      });
      setAfterAction(null);
      setAfterOpenRunId(null);
      router.push(`/(app)/runs/${runId}`);
    } catch (e) {
      if (e instanceof Error && e.message === 'NO_PUBLISHED_REVISION') {
        setError(copy.publishFirst);
      } else {
        setError(e instanceof Error ? e.message : t().common.errorGeneric);
      }
    } finally {
      setSaving(false);
    }
  };

  const addSection = () => {
    const id = newId();
    setSections((prev) => [...prev, { key: id, id, title: '' }]);
  };

  const addItem = (sectionId: string | null = null) => {
    const id = newId();
    setItems((prev) => [
      ...prev,
      {
        key: id,
        id,
        sectionId,
        title: '',
        instructions: '',
        frequency: prev.at(-1)?.frequency ?? null,
      },
    ]);
  };

  const applyPaste = () => {
    const lines = pastePreview;
    if (lines.length === 0) {
      setPasteOpen(false);
      return;
    }
    setItems((prev) => {
      const frequency = prev.at(-1)?.frequency ?? null;
      return [
        ...prev,
        ...lines.map((line) => {
          const id = newId();
          return {
            key: id,
            id,
            sectionId: null,
            title: line,
            instructions: '',
            frequency,
          };
        }),
      ];
    });
    setPasteRaw('');
    setPasteOpen(false);
  };

  const renderItem = useCallback(
    ({ item, drag, isActive }: RenderItemParams<DraftItem>) => (
      <ScaleDecorator>
        <View
          style={{
            gap: theme.space.sm,
            padding: theme.space.md,
            marginBottom: theme.space.sm,
            borderRadius: theme.radii.sm,
            borderWidth: 1,
            borderColor: isActive ? theme.colors.primary : theme.colors.border,
            backgroundColor: theme.colors.white,
            opacity: isActive ? 0.95 : 1,
          }}
        >
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: theme.space.sm,
            }}
          >
            {!readOnly ? (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={copy.dragItem}
                onLongPress={drag}
                delayLongPress={120}
                hitSlop={8}
                style={({ pressed }) => ({
                  width: 40,
                  height: 40,
                  alignItems: 'center',
                  justifyContent: 'center',
                  borderRadius: theme.radii.sm,
                  backgroundColor: theme.colors.sand,
                  opacity: pressed ? 0.75 : 1,
                })}
              >
                <Ionicons
                  name="reorder-three"
                  size={24}
                  color={theme.colors.inkMuted}
                />
              </Pressable>
            ) : (
              <View style={{ width: 8 }} />
            )}
            {!readOnly ? (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={copy.removeItem}
                onPress={() =>
                  setItems((prev) => prev.filter((i) => i.key !== item.key))
                }
                hitSlop={8}
                style={{
                  width: 40,
                  height: 40,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Ionicons
                  name="trash-outline"
                  size={20}
                  color={theme.colors.coral}
                />
              </Pressable>
            ) : null}
          </View>
          <TextField
            label={copy.itemTitlePlaceholder}
            value={item.title}
            editable={!readOnly}
            onChangeText={(text) =>
              setItems((prev) =>
                prev.map((i) =>
                  i.key === item.key ? { ...i, title: text } : i,
                ),
              )
            }
          />
          <TextField
            label={copy.itemInstructionsPlaceholder}
            value={item.instructions}
            editable={!readOnly}
            multiline
            onChangeText={(text) =>
              setItems((prev) =>
                prev.map((i) =>
                  i.key === item.key ? { ...i, instructions: text } : i,
                ),
              )
            }
          />
          <View style={{ gap: theme.space.xs }}>
            <Text
              style={{
                fontFamily: theme.fonts.label,
                fontSize: theme.typography.caption.fontSize,
                color: theme.colors.inkSubtle,
              }}
              allowFontScaling
            >
              {recurringCopy.frequencyLabel}
            </Text>
            {readOnly ? (
              <Text
                style={{
                  fontFamily: theme.fonts.body,
                  fontSize: theme.typography.bodySmall.fontSize,
                  color: theme.colors.inkMuted,
                }}
                allowFontScaling
              >
                {item.frequency ? recurringCopy[item.frequency] : recurringCopy.oneOff}
              </Text>
            ) : (
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={{ gap: theme.space.sm }}
              >
                {([null, ...TASK_FREQUENCIES] as (TaskFrequency | null)[]).map((f) => (
                  <CatChip
                    key={f ?? 'once'}
                    label={f ? recurringCopy[f] : recurringCopy.oneOff}
                    selected={item.frequency === f}
                    onPress={() =>
                      setItems((prev) =>
                        prev.map((i) =>
                          i.key === item.key ? { ...i, frequency: f } : i,
                        ),
                      )
                    }
                  />
                ))}
              </ScrollView>
            )}
          </View>
          {sections.length > 0 && !readOnly ? (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ gap: theme.space.sm }}
            >
              <CatChip
                label={copy.noCategory}
                selected={item.sectionId == null}
                onPress={() =>
                  setItems((prev) =>
                    prev.map((i) =>
                      i.key === item.key ? { ...i, sectionId: null } : i,
                    ),
                  )
                }
              />
              {sections.map((s) => (
                <CatChip
                  key={s.key}
                  label={s.title.trim() || copy.sectionPlaceholder}
                  selected={item.sectionId === s.id}
                  onPress={() =>
                    setItems((prev) =>
                      prev.map((i) =>
                        i.key === item.key ? { ...i, sectionId: s.id } : i,
                      ),
                    )
                  }
                />
              ))}
            </ScrollView>
          ) : null}
        </View>
      </ScaleDecorator>
    ),
    [copy, recurringCopy, readOnly, sections, theme],
  );

  if (!kitchenId) {
    return (
      <Screen>
        <Text
          style={{
            marginTop: theme.space.xl,
            fontFamily: theme.fonts.body,
            color: theme.colors.inkMuted,
          }}
        >
          {copy.needKitchen}
        </Text>
      </Screen>
    );
  }

  if (!templateId || loading) {
    return (
      <Screen>
        <ActivityIndicator
          color={theme.colors.primary}
          style={{ marginTop: theme.space.xxl }}
        />
      </Screen>
    );
  }

  const listHeader = (
    <View style={{ gap: theme.space.lg, marginBottom: theme.space.md }}>
      <NetworkRequiredBanner visible={syncStatus.kind === 'offline'} />
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
          {exists ? copy.editTitle : copy.newTitle}
        </Text>
        <View style={{ width: 48 }} />
      </View>

      {readOnly ? (
        <Text
          style={{
            fontFamily: theme.fonts.body,
            color: theme.colors.coral,
            fontSize: theme.typography.caption.fontSize,
          }}
          allowFontScaling
        >
          {copy.archivedReadOnly}
        </Text>
      ) : null}

      <TextField
        label={copy.titleLabel}
        value={title}
        onChangeText={setTitle}
        placeholder={copy.titlePlaceholder}
        editable={!readOnly}
      />
      <TextField
        label={copy.descriptionLabel}
        value={description}
        onChangeText={setDescription}
        placeholder={copy.descriptionPlaceholder}
        editable={!readOnly}
        multiline
      />

      <View style={{ gap: theme.space.sm }}>
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
          {copy.categoryLabel}
        </Text>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ gap: theme.space.sm }}
        >
          <CatChip
            label={copy.noCategory}
            selected={categoryId == null}
            disabled={readOnly}
            onPress={() => setCategoryId(null)}
          />
          {categories.map((cat) => (
            <CatChip
              key={cat.id}
              label={cat.name}
              selected={categoryId === cat.id}
              disabled={readOnly}
              onPress={() => setCategoryId(cat.id)}
            />
          ))}
        </ScrollView>
      </View>

      <View style={{ gap: theme.space.sm }}>
        <View
          style={{
            flexDirection: 'row',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <Text
            style={{
              fontFamily: theme.fonts.displayRegular,
              fontSize: theme.typography.heading.fontSize,
              color: theme.colors.ink,
            }}
            allowFontScaling
          >
            {copy.sectionsTitle}
          </Text>
          {!readOnly ? (
            <Button label={copy.addSection} variant="ghost" onPress={addSection} />
          ) : null}
        </View>
        {sections.map((section) => (
          <View
            key={section.key}
            style={{
              gap: theme.space.sm,
              padding: theme.space.md,
              borderRadius: theme.radii.sm,
              borderWidth: 1,
              borderColor: theme.colors.border,
              backgroundColor: theme.colors.sand,
            }}
          >
            <TextField
              label={copy.sectionPlaceholder}
              value={section.title}
              editable={!readOnly}
              onChangeText={(text) =>
                setSections((prev) =>
                  prev.map((s) =>
                    s.key === section.key ? { ...s, title: text } : s,
                  ),
                )
              }
            />
            {!readOnly ? (
              <Button
                label={copy.removeSection}
                variant="ghost"
                onPress={() => {
                  setSections((prev) =>
                    prev.filter((s) => s.key !== section.key),
                  );
                  setItems((prev) =>
                    prev.map((i) =>
                      i.sectionId === section.id
                        ? { ...i, sectionId: null }
                        : i,
                    ),
                  );
                }}
              />
            ) : null}
          </View>
        ))}
      </View>

      <View
        style={{
          flexDirection: 'row',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: theme.space.sm,
        }}
      >
        <Text
          style={{
            fontFamily: theme.fonts.displayRegular,
            fontSize: theme.typography.heading.fontSize,
            color: theme.colors.ink,
          }}
          allowFontScaling
        >
          {copy.itemsTitle}
        </Text>
        {!readOnly ? (
          <View style={{ flexDirection: 'row', gap: theme.space.sm }}>
            <Button
              label={copy.pasteItems}
              variant="secondary"
              onPress={() => setPasteOpen(true)}
            />
            <Button
              label={copy.addItem}
              variant="ghost"
              onPress={() => addItem(null)}
            />
          </View>
        ) : null}
      </View>
    </View>
  );

  const listFooter = (
    <View style={{ gap: theme.space.lg, marginTop: theme.space.md }}>
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

      {!readOnly ? (
        <View style={{ gap: theme.space.sm }}>
          {alreadyUsed ? (
            <Button
              label={copy.saveChanges}
              loading={saving}
              onPress={() => void onSaveChanges()}
            />
          ) : (
            <>
              <Button
                label={copy.saveDraft}
                variant="secondary"
                loading={saving}
                onPress={() => void onSaveDraft()}
              />
              <Button
                label={copy.publish}
                loading={saving}
                onPress={() => void onPublish()}
              />
            </>
          )}
        </View>
      ) : null}

      {exists ? (
        <View style={{ gap: theme.space.sm }}>
          <Button
            label={copy.duplicate}
            variant="secondary"
            loading={saving}
            onPress={() => void onDuplicate()}
          />
          {!readOnly ? (
            <Button
              label={copy.archive}
              variant="danger"
              loading={saving}
              onPress={onArchive}
            />
          ) : null}
          {(state === 'active' || publishedRevision) && !libraryCopy ? (
            <Button
              label={copy.addSchedule}
              variant="ghost"
              onPress={() =>
                router.push(`/(app)/(tabs)/templates/${templateId}/schedule`)
              }
            />
          ) : null}
        </View>
      ) : null}

      <Text
        style={{
          fontFamily: theme.fonts.labelRegular,
          fontSize: theme.typography.caption.fontSize,
          color: theme.colors.inkSubtle,
        }}
        allowFontScaling
      >
        {user?.email ?? ''}
      </Text>
    </View>
  );

  return (
    <Screen>
      {readOnly ? (
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={{ paddingBottom: theme.space.xxl }}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {listHeader}
          {items.map((item) => (
            <View
              key={item.key}
              style={{
                gap: theme.space.sm,
                padding: theme.space.md,
                marginBottom: theme.space.sm,
                borderRadius: theme.radii.sm,
                borderWidth: 1,
                borderColor: theme.colors.border,
                backgroundColor: theme.colors.white,
              }}
            >
              <TextField
                label={copy.itemTitlePlaceholder}
                value={item.title}
                editable={false}
              />
              {item.instructions ? (
                <TextField
                  label={copy.itemInstructionsPlaceholder}
                  value={item.instructions}
                  editable={false}
                  multiline
                />
              ) : null}
            </View>
          ))}
          {listFooter}
        </ScrollView>
      ) : (
        <DraggableFlatList
          style={{ flex: 1 }}
          containerStyle={{ flex: 1 }}
          data={items}
          keyExtractor={(item) => item.key}
          onDragBegin={() => {
            void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
          }}
          onDragEnd={({ data }) => setItems(data)}
          renderItem={renderItem}
          ListHeaderComponent={listHeader}
          ListFooterComponent={listFooter}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{ paddingBottom: theme.space.xxl }}
          activationDistance={12}
        />
      )}

      <Modal visible={pasteOpen} animationType="slide" transparent>
        <View
          style={{
            flex: 1,
            justifyContent: 'flex-end',
            backgroundColor: theme.colors.overlay,
          }}
        >
          <View
            style={{
              backgroundColor: theme.colors.canvas,
              borderTopLeftRadius: theme.radii.lg,
              borderTopRightRadius: theme.radii.lg,
              padding: theme.space.lg,
              gap: theme.space.md,
              maxHeight: '80%',
            }}
          >
            <Text
              style={{
                fontFamily: theme.fonts.displayRegular,
                fontSize: theme.typography.heading.fontSize,
                color: theme.colors.ink,
              }}
              allowFontScaling
            >
              {copy.pastePreviewTitle}
            </Text>
            <Text
              style={{
                fontFamily: theme.fonts.body,
                color: theme.colors.inkMuted,
                fontSize: theme.typography.bodySmall.fontSize,
              }}
              allowFontScaling
            >
              {copy.pasteHint}
            </Text>
            <TextInput
              value={pasteRaw}
              onChangeText={setPasteRaw}
              multiline
              placeholder={copy.pasteHint}
              placeholderTextColor={theme.colors.inkSubtle}
              allowFontScaling
              style={{
                minHeight: 120,
                borderWidth: 1,
                borderColor: theme.colors.border,
                borderRadius: theme.radii.sm,
                padding: theme.space.md,
                backgroundColor: theme.colors.white,
                fontFamily: theme.fonts.body,
                color: theme.colors.ink,
                textAlignVertical: 'top',
              }}
            />
            {pastePreview.length > 0 ? (
              <ScrollView style={{ maxHeight: 160 }}>
                {pastePreview.map((line, i) => (
                  <Text
                    key={`${line}-${i}`}
                    style={{
                      fontFamily: theme.fonts.body,
                      color: theme.colors.ink,
                      paddingVertical: 4,
                    }}
                    allowFontScaling
                  >
                    • {line}
                  </Text>
                ))}
              </ScrollView>
            ) : null}
            <Button label={copy.pasteConfirm} onPress={applyPaste} />
            <Button
              label={t().common.cancel}
              variant="ghost"
              onPress={() => setPasteOpen(false)}
            />
          </View>
        </View>
      </Modal>

      <Modal visible={afterAction != null} animationType="fade" transparent>
        <View
          style={{
            flex: 1,
            justifyContent: 'center',
            padding: theme.space.lg,
            backgroundColor: theme.colors.overlay,
          }}
        >
          <View
            style={{
              backgroundColor: theme.colors.canvas,
              borderRadius: theme.radii.lg,
              padding: theme.space.xl,
              gap: theme.space.md,
            }}
          >
            <Text
              style={{
                fontFamily: theme.fonts.display,
                fontSize: theme.typography.heading.fontSize,
                color: theme.colors.ink,
              }}
              allowFontScaling
            >
              {afterAction === 'published'
                ? copy.afterPublishTitle
                : copy.afterSaveTitle}
            </Text>
            {afterAction === 'published' && afterOpenRunId ? (
              <Text
                style={{
                  fontFamily: theme.fonts.body,
                  fontSize: theme.typography.body.fontSize,
                  color: theme.colors.inkMuted,
                  lineHeight: theme.typography.body.lineHeight,
                }}
                allowFontScaling
              >
                {copy.afterPublishOpenHint}
              </Text>
            ) : null}
            <Button
              label={copy.returnToList}
              loading={saving}
              onPress={() => {
                setAfterAction(null);
                setAfterOpenRunId(null);
                router.replace('/(app)/(tabs)/templates');
              }}
            />
            {afterAction === 'published' || publishedRevision ? (
              <Button
                label={afterOpenRunId ? copy.continueRun : copy.useNow}
                variant="secondary"
                loading={saving}
                onPress={() => void onUseNow()}
              />
            ) : null}
            {!libraryCopy ? (
              <Button
                label={copy.addSchedule}
                variant="secondary"
                onPress={() => {
                  setAfterAction(null);
                  setAfterOpenRunId(null);
                  router.push(`/(app)/(tabs)/templates/${templateId}/schedule`);
                }}
              />
            ) : null}
          </View>
        </View>
      </Modal>
      {paywall}
    </Screen>
  );
}

function CatChip({
  label,
  selected,
  onPress,
  disabled = false,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
  disabled?: boolean;
}) {
  const theme = useTheme();
  return (
    <Pressable
      disabled={disabled}
      onPress={onPress}
      style={{
        paddingHorizontal: theme.space.md,
        paddingVertical: theme.space.sm,
        borderRadius: theme.radii.sm,
        borderWidth: 1,
        borderColor: selected ? theme.colors.primary : theme.colors.border,
        backgroundColor: selected ? theme.colors.sand : theme.colors.white,
        opacity: disabled ? 0.5 : 1,
      }}
    >
      <Text
        style={{
          fontFamily: theme.fonts.bodyMedium,
          fontSize: theme.typography.bodySmall.fontSize,
          color: selected ? theme.colors.primary : theme.colors.inkMuted,
        }}
        allowFontScaling
      >
        {label}
      </Text>
    </Pressable>
  );
}
