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
import { newId } from '@/lib/ids';
import { goBackOr } from '@/lib/navigation';
import { t } from '@/i18n';

type DraftItem = {
  key: string;
  id: string;
  sectionId: string | null;
  title: string;
  instructions: string;
};

type DraftSection = {
  key: string;
  id: string;
  title: string;
};

type AfterAction = 'saved' | 'published' | null;

export default function TemplateBuilderScreen() {
  const theme = useTheme();
  const { id } = useLocalSearchParams<{ id: string }>();
  const templateId = String(id);
  const { kitchenId, user } = useAuth();
  const { status: syncStatus } = useSync();
  const copy = t().templates;

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

  const readOnly = state === 'archived';
  const alreadyUsed = publishedRevision != null;

  const load = useCallback(async () => {
    if (!kitchenId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const [cats, detail] = await Promise.all([
        listCategories(kitchenId),
        getTemplate(templateId),
      ]);
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
          })),
        );
      } else {
        setExists(false);
        setRevision(0);
        setState('draft');
        setPublishedRevision(null);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : t().common.errorGeneric);
    } finally {
      setLoading(false);
    }
  }, [kitchenId, templateId]);

  useEffect(() => {
    void load();
  }, [load]);

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
    if (!kitchenId) throw new Error(copy.needKitchen);
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
    return result.revision;
  };

  const resolveAfterOpenRun = async () => {
    if (!user?.id || !kitchenId) {
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

  const onSaveDraft = async () => {
    setSaving(true);
    setError(null);
    try {
      await commitSaveDraft();
    } catch (e) {
      setError(e instanceof Error ? e.message : t().common.errorGeneric);
    } finally {
      setSaving(false);
    }
  };

  const onPublish = async () => {
    const payload = buildPayload();
    if (payload.items.length === 0) {
      setError(copy.needItems);
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await commitPublish();
    } catch (e) {
      setError(e instanceof Error ? e.message : t().common.errorGeneric);
    } finally {
      setSaving(false);
    }
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
    setSaving(true);
    setError(null);
    try {
      await commitPublish();
    } catch (e) {
      setError(e instanceof Error ? e.message : t().common.errorGeneric);
    } finally {
      setSaving(false);
    }
  };

  const onDuplicate = async () => {
    setSaving(true);
    try {
      if (!exists) await persistDraft();
      const dup = await duplicateTemplate(templateId);
      router.replace(`/(app)/(tabs)/templates/${dup.templateId}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : t().common.errorGeneric);
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
          setSaving(true);
          try {
            await archiveTemplate({
              templateId,
              expectedRevision: revision,
            });
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
    if (!kitchenId || !user?.id) {
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
      { key: id, id, sectionId, title: '', instructions: '' },
    ]);
  };

  const applyPaste = () => {
    const lines = pastePreview;
    if (lines.length === 0) {
      setPasteOpen(false);
      return;
    }
    setItems((prev) => [
      ...prev,
      ...lines.map((line) => {
        const id = newId();
        return {
          key: id,
          id,
          sectionId: null,
          title: line,
          instructions: '',
        };
      }),
    ]);
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
    [copy, readOnly, sections, theme],
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
          {state === 'active' || publishedRevision ? (
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
            <Button
              label={copy.addSchedule}
              variant="secondary"
              onPress={() => {
                setAfterAction(null);
                setAfterOpenRunId(null);
                router.push(`/(app)/(tabs)/templates/${templateId}/schedule`);
              }}
            />
          </View>
        </View>
      </Modal>
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
