import { useCallback, useMemo, useState } from 'react';
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
import { router, useFocusEffect } from 'expo-router';

import {
  Button,
  Chip,
  ChipScroller,
  EmptyState,
  IconButton,
  IconTile,
  ListRow,
  Screen,
  ScreenHeader,
} from '@/components/ui';
import { useTheme } from '@/design';
import { useAuth } from '@/features/auth';
import { useCatalog } from '@/features/catalog';
import {
  TASK_FREQUENCIES,
  useRecurringTasks,
  type TaskFrequency,
} from '@/features/recurring';
import {
  archiveCategory,
  listCategories,
  renameCategory,
  reorderCategories,
  type Category,
} from '@/features/categories/api';
import {
  listTemplates,
  type TemplateState,
  type TemplateSummary,
} from '@/features/templates/api';
import { useT, tone } from '@/i18n';

type CategoryFilter = 'all' | 'uncategorized' | string;
type StateFilter = 'all' | TemplateState;

function TemplateCard({
  template,
  frequencies,
  stateLabel,
  onPress,
}: {
  template: TemplateSummary;
  frequencies: TaskFrequency[];
  stateLabel: string;
  onPress: () => void;
}) {
  const theme = useTheme();
  const showBadge = template.state !== 'active';
  const meta = [showBadge ? null : stateLabel, template.description]
    .filter(Boolean)
    .join(' · ');

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${template.title}, ${stateLabel}`}
      onPress={onPress}
      style={({ pressed }) => ({
        flexDirection: 'row',
        alignItems: 'center',
        gap: theme.space.lg,
        padding: theme.space.xl - 4,
        borderRadius: 24,
        borderWidth: 0.5,
        borderColor: theme.colors.border,
        backgroundColor: pressed ? theme.colors.sand : theme.colors.card,
        boxShadow: theme.shadows.soft,
        opacity: template.state === 'archived' ? 0.7 : 1,
      })}
    >
      <View style={{ flex: 1, gap: theme.space.sm }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.space.sm }}>
          <Text
            style={{
              flexShrink: 1,
              fontFamily: theme.fonts.bodyExtraBold,
              fontSize: theme.typography.cardTitle.fontSize,
              lineHeight: theme.typography.cardTitle.lineHeight,
              color: theme.colors.ink,
            }}
            numberOfLines={2}
            allowFontScaling
          >
            {template.title}
          </Text>
          {showBadge ? (
            <View
              style={{
                paddingHorizontal: theme.space.sm,
                paddingVertical: 2,
                borderRadius: 6,
                backgroundColor: theme.colors.sand,
              }}
            >
              <Text
                style={{
                  fontFamily: theme.fonts.label,
                  fontSize: 10,
                  lineHeight: 14,
                  letterSpacing: 0.8,
                  textTransform: 'uppercase',
                  color: theme.colors.inkMuted,
                }}
                allowFontScaling
              >
                {stateLabel}
              </Text>
            </View>
          ) : null}
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.space.md }}>
          <View style={{ flexDirection: 'row', gap: 6 }}>
            {frequencies.length > 0 ? (
              frequencies.map((frequency) => (
                <View
                  key={frequency}
                  style={{
                    width: 10,
                    height: 10,
                    borderRadius: 5,
                    backgroundColor: theme.colors.frequency[frequency].base,
                  }}
                />
              ))
            ) : (
              <View
                style={{
                  width: 10,
                  height: 10,
                  borderRadius: 5,
                  backgroundColor: theme.colors.border,
                }}
              />
            )}
          </View>
          {meta ? (
            <Text
              style={{
                flex: 1,
                fontFamily: theme.fonts.bodySemiBold,
                fontSize: theme.typography.caption.fontSize,
                lineHeight: theme.typography.caption.lineHeight,
                color: theme.colors.inkMuted,
              }}
              numberOfLines={1}
              allowFontScaling
            >
              {meta}
            </Text>
          ) : null}
        </View>
      </View>
      <Ionicons name="chevron-forward" size={16} color={theme.colors.inkSubtle} />
    </Pressable>
  );
}

export default function TemplatesScreen() {
  const t = useT();
  const theme = useTheme();
  const { kitchenMode, kitchenId, onboarding, user } = useAuth();
  const catalog = useCatalog();
  const copy = t().templates;
  const recurring = useRecurringTasks(user?.id, kitchenId);
  const reloadRecurring = recurring.reload;
  const frequenciesByTemplate = useMemo(() => {
    const found = new Map<string, Set<TaskFrequency>>();
    for (const task of recurring.tasks) {
      const set = found.get(task.templateId) ?? new Set<TaskFrequency>();
      set.add(task.frequency);
      found.set(task.templateId, set);
    }
    return new Map(
      [...found].map(([id, set]) => [id, TASK_FREQUENCIES.filter((f) => set.has(f))]),
    );
  }, [recurring.tasks]);
  const catCopy = t().categories;

  const [categories, setCategories] = useState<Category[]>([]);
  const [templates, setTemplates] = useState<TemplateSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<CategoryFilter>('all');
  const [stateFilter, setStateFilter] = useState<StateFilter>('all');
  const [renameTarget, setRenameTarget] = useState<Category | null>(null);
  const [renameValue, setRenameValue] = useState('');

  const load = useCallback(async () => {
    if (!kitchenId) {
      setLoading(false);
      setCategories([]);
      setTemplates([]);
      return;
    }
    setError(null);
    setLoading(true);
    try {
      const [cats, tmpls] = await Promise.all([
        listCategories(kitchenId),
        listTemplates(kitchenId, {
          state: stateFilter,
          categoryId:
            categoryFilter === 'all'
              ? undefined
              : categoryFilter === 'uncategorized'
                ? 'uncategorized'
                : categoryFilter,
          search,
        }),
      ]);
      setCategories(cats);
      setTemplates(tmpls);
    } catch (e) {
      setError(e instanceof Error ? e.message : t().common.errorGeneric);
    } finally {
      setLoading(false);
    }
  }, [kitchenId, stateFilter, categoryFilter, search, t]);

  useFocusEffect(
    useCallback(() => {
      void load();
      reloadRecurring().catch(() => undefined);
    }, [load, reloadRecurring]),
  );

  const onRenameCategory = (cat: Category) => {
    setRenameTarget(cat);
    setRenameValue(cat.name);
  };

  const submitRename = async () => {
    if (!renameTarget || !renameValue.trim()) {
      setRenameTarget(null);
      return;
    }
    try {
      await renameCategory({
        categoryId: renameTarget.id,
        name: renameValue,
        expectedRevision: renameTarget.revision,
      });
      setRenameTarget(null);
      await load();
    } catch (e) {
      Alert.alert(
        t().common.errorGeneric,
        e instanceof Error ? e.message : undefined,
      );
    }
  };

  const moveCategory = async (index: number, direction: -1 | 1) => {
    const next = index + direction;
    if (next < 0 || next >= categories.length) return;
    const ordered = categories.map((c, i) => ({ ...c }));
    const tmp = ordered[index];
    ordered[index] = ordered[next];
    ordered[next] = tmp;
    const payload = ordered.map((c, i) => ({
      id: c.id,
      revision: c.revision,
      sortOrder: i,
    }));
    try {
      await reorderCategories(payload);
      await load();
    } catch (e) {
      Alert.alert(t().common.errorGeneric, e instanceof Error ? e.message : undefined);
    }
  };

  const onArchiveCategory = (cat: Category) => {
    Alert.alert(t().common.archive, catCopy.archiveConfirm, [
      { text: t().common.cancel, style: 'cancel' },
      {
        text: t().common.archive,
        style: 'destructive',
        onPress: async () => {
          try {
            await archiveCategory({
              categoryId: cat.id,
              expectedRevision: cat.revision,
            });
            if (categoryFilter === cat.id) setCategoryFilter('all');
            await load();
          } catch (e) {
            Alert.alert(
              t().common.errorGeneric,
              e instanceof Error ? e.message : undefined,
            );
          }
        },
      },
    ]);
  };

  const openCatalog = () => router.push('/(app)/(tabs)/templates/catalog');

  const stateLabel = (state: TemplateState) => {
    if (state === 'active') return copy.stateActive;
    if (state === 'archived') return copy.stateArchived;
    return copy.stateDraft;
  };

  if (!kitchenId) {
    return (
      <Screen>
        <EmptyState title={copy.titleHome} body={copy.needKitchen} />
      </Screen>
    );
  }

  const libraryCount = catalog.presets.length;

  return (
    <Screen>
      <View style={{ flex: 1 }}>
        <View style={{ gap: theme.space.lg, flexGrow: 0, flexShrink: 0 }}>
          <ScreenHeader
            size="display"
            eyebrow={onboarding?.kitchenName || undefined}
            title={tone(kitchenMode, copy.titleHome, copy.titleBusiness)}
            right={
              <IconButton
                name="add"
                accessibilityLabel={copy.emptyAction}
                onPress={() => router.push('/(app)/(tabs)/templates/new')}
              />
            }
          />

          <ListRow
            title={copy.browseTemplates}
            subtitle={copy.libraryCount.replace('{count}', String(libraryCount))}
            left={<IconTile name="book-outline" />}
            onPress={openCatalog}
            style={{ borderRadius: theme.radii.xxl, backgroundColor: theme.colors.white }}
          />

          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: theme.space.sm,
              minHeight: 52,
              paddingHorizontal: theme.space.lg,
              borderRadius: theme.radii.xl,
              borderWidth: 0.5,
              borderColor: theme.colors.border,
              backgroundColor: theme.colors.white,
            }}
          >
            <Ionicons name="search-outline" size={20} color={theme.colors.inkMuted} />
            <TextInput
              value={search}
              onChangeText={setSearch}
              onEndEditing={() => void load()}
              placeholder={copy.searchPlaceholder}
              placeholderTextColor={theme.colors.inkSubtle}
              returnKeyType="search"
              allowFontScaling
              style={{
                flex: 1,
                minHeight: 48,
                fontFamily: theme.fonts.bodyMedium,
                fontSize: theme.typography.body.fontSize,
                color: theme.colors.ink,
                textAlignVertical: 'center',
                includeFontPadding: false,
              }}
            />
          </View>

          <ChipScroller scroll>
            {(
              [
                ['all', copy.filterAll],
                ['active', copy.filterActive],
                ['draft', copy.filterDraft],
                ['archived', copy.filterArchived],
              ] as const
            ).map(([key, label]) => (
              <Chip
                key={`state-${key}`}
                label={label}
                selected={stateFilter === key}
                onPress={() => setStateFilter(key)}
              />
            ))}
            <Chip
              label={catCopy.uncategorized}
              selected={categoryFilter === 'uncategorized'}
              onPress={() =>
                setCategoryFilter(categoryFilter === 'uncategorized' ? 'all' : 'uncategorized')
              }
            />
            {categories.map((cat, index) => (
              <Chip
                key={cat.id}
                label={cat.name}
                selected={categoryFilter === cat.id}
                onPress={() => setCategoryFilter(categoryFilter === cat.id ? 'all' : cat.id)}
                onLongPress={() => {
                  Alert.alert(cat.name, undefined, [
                    {
                      text: t().common.rename,
                      onPress: () => onRenameCategory(cat),
                    },
                    {
                      text: catCopy.moveUp,
                      onPress: () => void moveCategory(index, -1),
                    },
                    {
                      text: catCopy.moveDown,
                      onPress: () => void moveCategory(index, 1),
                    },
                    {
                      text: t().common.archive,
                      style: 'destructive',
                      onPress: () => onArchiveCategory(cat),
                    },
                    { text: t().common.cancel, style: 'cancel' },
                  ]);
                }}
              />
            ))}
          </ChipScroller>
        </View>

        {error ? (
          <Text
            style={{
              fontFamily: theme.fonts.bodyMedium,
              color: theme.colors.coral,
              fontSize: theme.typography.caption.fontSize,
              marginTop: theme.space.sm,
            }}
            allowFontScaling
          >
            {error}
          </Text>
        ) : null}

        <View style={{ flex: 1, minHeight: 0, marginTop: theme.space.sm }}>
          {loading ? (
            <ActivityIndicator
              color={theme.colors.primary}
              style={{ marginTop: theme.space.lg }}
            />
          ) : templates.length === 0 ? (
            <View>
              <EmptyState
                title={tone(
                  kitchenMode,
                  copy.emptyTitleHome,
                  copy.emptyTitleBusiness,
                )}
                body={tone(
                  kitchenMode,
                  copy.emptyBodyHome,
                  copy.emptyBodyBusiness,
                )}
                actionLabel={copy.browseTemplates}
                onAction={openCatalog}
              />
              <Button
                label={copy.emptyAction}
                variant="ghost"
                onPress={() => router.push('/(app)/(tabs)/templates/new')}
              />
            </View>
          ) : (
            <ScrollView
              style={{ flex: 1 }}
              contentContainerStyle={{
                gap: theme.space.lg,
                paddingTop: theme.space.sm,
                paddingBottom: theme.space.xxxl,
              }}
              showsVerticalScrollIndicator={false}
            >
              {templates.map((tmpl) => (
                <TemplateCard
                  key={tmpl.id}
                  template={tmpl}
                  frequencies={frequenciesByTemplate.get(tmpl.id) ?? []}
                  stateLabel={stateLabel(tmpl.state)}
                  onPress={() =>
                    router.push(
                      tmpl.publishedRevision != null
                        ? `/(app)/(tabs)/templates/${tmpl.id}/hub`
                        : `/(app)/(tabs)/templates/${tmpl.id}`,
                    )
                  }
                />
              ))}
            </ScrollView>
          )}
        </View>
      </View>

      <Modal visible={renameTarget != null} animationType="fade" transparent>
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
              borderRadius: theme.radii.xxl,
              padding: theme.space.xl,
              gap: theme.space.md,
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
              {catCopy.renamePrompt}
            </Text>
            <TextInput
              value={renameValue}
              onChangeText={setRenameValue}
              autoFocus
              allowFontScaling
              style={{
                minHeight: 52,
                paddingHorizontal: theme.space.lg,
                borderRadius: theme.radii.xl,
                borderWidth: 1,
                borderColor: theme.colors.border,
                backgroundColor: theme.colors.white,
                fontFamily: theme.fonts.body,
                fontSize: theme.typography.body.fontSize,
                color: theme.colors.ink,
              }}
            />
            <Button label={t().common.save} onPress={() => void submitRename()} />
            <Button
              label={t().common.cancel}
              variant="ghost"
              onPress={() => setRenameTarget(null)}
            />
          </View>
        </View>
      </Modal>
    </Screen>
  );
}

