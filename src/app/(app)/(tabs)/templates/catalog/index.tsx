import { useDeferredValue, useMemo, useState } from 'react';
import { ScrollView, View } from 'react-native';
import { router } from 'expo-router';

import { Button, EmptyState, Screen, ScreenHeader, SectionLabel } from '@/components/ui';
import { useTheme } from '@/design';
import { useAuth } from '@/features/auth';
import {
  catalog,
  categoryForKitchenMode,
  getPreset,
  searchCatalog,
  type CatalogCategory,
  type CatalogScope,
} from '@/features/catalog';
import {
  CatalogBackLink,
  CatalogSearchField,
  countLabel,
  GroupCard,
  PresetRow,
  ScopeChips
} from '@/features/catalog/components';
import { t } from '@/i18n';

const openPreset = (id: string) =>
  router.push(`/(app)/(tabs)/templates/catalog/preset/${id}`);

/** Temporary library entry: search plus icon categories over the bundled catalog. */
export default function TemplateCatalogScreen() {
  const theme = useTheme();
  const { kitchenMode } = useAuth();
  const copy = t().catalog;
  const preferred = categoryForKitchenMode(kitchenMode);

  const [scope, setScope] = useState<CatalogScope>(preferred);
  const [query, setQuery] = useState('');
  const deferredQuery = useDeferredValue(query);
  const searching = deferredQuery.trim().length > 0;

  const results = useMemo(
    () =>
      searching
        ? searchCatalog(catalog, deferredQuery, { scope, preferred })
        : [],
    [deferredQuery, preferred, scope, searching],
  );

  const visibleCategories = useMemo(() => {
    const ordered = [...catalog.categories].sort((a, b) =>
      a.key === preferred ? -1 : b.key === preferred ? 1 : 0,
    );
    return scope === 'all' ? ordered : ordered.filter((c) => c.key === scope);
  }, [preferred, scope]);

  const renderCategory = (category: CatalogCategory) => (
    <View key={category.key} style={{ gap: theme.space.md }}>
      {scope === 'all' ? <SectionLabel>{category.label}</SectionLabel> : null}
      <View style={{ gap: theme.space.sm }}>
        <SectionLabel>{copy.featuredTitle}</SectionLabel>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ gap: theme.space.sm, paddingRight: theme.space.lg }}
        >
          {category.featured.map((id) => {
            const preset = getPreset(id);
            if (!preset) return null;
            return (
              <View key={id} style={{ width: 240 }}>
                <PresetRow preset={preset} onPress={() => openPreset(id)} />
              </View>
            );
          })}
        </ScrollView>
      </View>
      <View style={{ gap: theme.space.sm }}>
        <SectionLabel>{copy.categoriesTitle}</SectionLabel>
        <View
          style={{
            flexDirection: 'row',
            flexWrap: 'wrap',
            justifyContent: 'space-between',
          }}
        >
          {category.groups.map((group) => (
            <GroupCard
              key={group.key}
              group={group}
              onPress={() =>
                router.push(`/(app)/(tabs)/templates/catalog/group/${group.key}`)
              }
            />
          ))}
        </View>
      </View>
    </View>
  );

  return (
    <Screen>
      <View style={{ flex: 1 }}>
        <View style={{ gap: 10, flexShrink: 0 }}>
          <CatalogBackLink />
          <ScreenHeader title={copy.title} eyebrow={copy.eyebrow} />
          <CatalogSearchField value={query} onChangeText={setQuery} />
          <ScopeChips scope={scope} onChange={setScope} />
        </View>

        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={{
            gap: theme.space.xl,
            paddingTop: theme.space.sm,
            paddingBottom: theme.space.xxl,
          }}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          showsVerticalScrollIndicator={false}
        >
          {!searching ? (
            visibleCategories.map(renderCategory)
          ) : results.length === 0 ? (
            <View style={{ gap: theme.space.sm }}>
              <EmptyState title={copy.noResultsTitle} body={copy.noResultsBody} />
              {scope !== 'all' ? (
                <Button
                  label={copy.clearFilter}
                  variant="secondary"
                  onPress={() => setScope('all')}
                />
              ) : null}
              <Button
                label={copy.createCustom}
                variant="ghost"
                onPress={() => router.push('/(app)/(tabs)/templates/new')}
              />
            </View>
          ) : (
            <View style={{ gap: theme.space.sm }}>
              <SectionLabel>
                {countLabel(results.length, copy.resultsCountOne, copy.resultsCount)}
              </SectionLabel>
              {results.map(({ preset }) => (
                <PresetRow
                  key={preset.id}
                  preset={preset}
                  showContext
                  onPress={() => openPreset(preset.id)}
                />
              ))}
            </View>
          )}
        </ScrollView>
      </View>
    </Screen>
  );
}
