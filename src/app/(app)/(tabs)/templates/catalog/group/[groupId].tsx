import { ScrollView, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';

import { EmptyState, Screen, ScreenHeader } from '@/components/ui';
import { useTheme } from '@/design';
import { findGroup, getPreset } from '@/features/catalog';
import {
  CatalogBackLink,
  countLabel,
  PresetRow,
} from '@/features/catalog/components';
import { t } from '@/i18n';

export default function CatalogGroupScreen() {
  const theme = useTheme();
  const { groupId } = useLocalSearchParams<{ groupId: string }>();
  const found = findGroup(String(groupId));
  const copy = t().catalog;

  if (!found) {
    return (
      <Screen>
        <CatalogBackLink />
        <EmptyState title={copy.title} body={copy.notFound} />
      </Screen>
    );
  }

  const { category, group } = found;
  const presets = group.presetIds.flatMap((id) => getPreset(id) ?? []);

  return (
    <Screen>
      <View style={{ flex: 1, gap: 10 }}>
        <CatalogBackLink />
        <ScreenHeader
          eyebrow={`${category.label} · ${countLabel(
            presets.length,
            copy.templateCountOne,
            copy.templateCount,
          )}`}
          title={group.label}
        />
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={{
            gap: theme.space.sm,
            paddingTop: theme.space.sm,
            paddingBottom: theme.space.xxl,
          }}
          showsVerticalScrollIndicator={false}
        >
          {presets.map((preset) => (
            <PresetRow
              key={preset.id}
              preset={preset}
              onPress={() =>
                router.push(`/(app)/(tabs)/templates/catalog/preset/${preset.id}`)
              }
            />
          ))}
        </ScrollView>
      </View>
    </Screen>
  );
}
