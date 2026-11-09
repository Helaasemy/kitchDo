import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  ScrollView,
  Text,
  TextInput,
  View,
} from 'react-native';
import { router, useFocusEffect } from 'expo-router';

import {
  Button,
  Chip,
  EmptyState,
  IconButton,
  ListRow,
  Screen,
  ScreenHeader,
} from '@/components/ui';
import { useTheme } from '@/design';
import { useAuth } from '@/features/auth';
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
import { t, tone } from '@/i18n';

type CategoryFilter = 'all' | 'uncategorized' | string;
type StateFilter = 'all' | TemplateState;

export default function TemplatesScreen() {
  const theme = useTheme();
  const { kitchenMode, kitchenId } = useAuth();
  const copy = t().templates;
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
  }, [kitchenId, stateFilter, categoryFilter, search]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
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

  return (
    <Screen>
      <View style={{ flex: 1 }}>
        <View style={{ gap: 10, flexGrow: 0, flexShrink: 0 }}>
          <ScreenHeader
            title={tone(kitchenMode, copy.titleHome, copy.titleBusiness)}
            right={
              <View style={{ flexDirection: 'row', gap: theme.space.sm }}>
                <IconButton
                  name="library-outline"
                  accessibilityLabel={copy.browseTemplates}
                  onPress={openCatalog}
                />
                <IconButton
                  name="add"
                  accessibilityLabel={copy.emptyAction}
                  onPress={() => router.push('/(app)/(tabs)/templates/new')}
                />
              </View>
            }
          />

          <Button
            label={copy.browseTemplates}
            variant="secondary"
            compact
            onPress={openCatalog}
          />

          <TextInput
            value={search}
            onChangeText={setSearch}
            onEndEditing={() => void load()}
            placeholder={copy.searchPlaceholder}
            placeholderTextColor={theme.colors.inkSubtle}
            allowFontScaling
            style={{
              width: '100%',
              minHeight: 44,
              paddingHorizontal: theme.space.md,
              borderRadius: theme.radii.sm,
              borderWidth: 1,
              borderColor: theme.colors.border,
              backgroundColor: theme.colors.white,
              fontFamily: theme.fonts.body,
              fontSize: theme.typography.body.fontSize,
              color: theme.colors.ink,
              textAlignVertical: 'center',
              includeFontPadding: false,
            }}
          />

          {/* marginRight on chips — more reliable than gap on wrapped rows */}
          <View
            style={{
              flexDirection: 'row',
              flexWrap: 'wrap',
              justifyContent: 'flex-start',
              alignItems: 'flex-start',
              alignContent: 'flex-start',
              width: '100%',
              flexGrow: 0,
            }}
          >
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
              label={catCopy.all}
              selected={categoryFilter === 'all'}
              onPress={() => setCategoryFilter('all')}
            />
            <Chip
              label={catCopy.uncategorized}
              selected={categoryFilter === 'uncategorized'}
              onPress={() => setCategoryFilter('uncategorized')}
            />
            {categories.map((cat, index) => (
              <Chip
                key={cat.id}
                label={cat.name}
                selected={categoryFilter === cat.id}
                onPress={() => setCategoryFilter(cat.id)}
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
          </View>
        </View>

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

        <View style={{ flex: 1, minHeight: 0, marginTop: 12 }}>
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
                gap: theme.space.sm,
                paddingBottom: theme.space.xxl,
              }}
              showsVerticalScrollIndicator={false}
            >
              {templates.map((tmpl) => (
                <ListRow
                  key={tmpl.id}
                  title={tmpl.title}
                  subtitle={`${stateLabel(tmpl.state)}${
                    tmpl.description ? ` · ${tmpl.description}` : ''
                  }`}
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
              borderRadius: theme.radii.lg,
              padding: theme.space.xl,
              gap: theme.space.md,
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
              {catCopy.renamePrompt}
            </Text>
            <TextInput
              value={renameValue}
              onChangeText={setRenameValue}
              autoFocus
              allowFontScaling
              style={{
                minHeight: 48,
                paddingHorizontal: theme.space.md,
                borderRadius: theme.radii.sm,
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

