import type { ComponentProps } from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';

import { Chip, ListRow } from '@/components/ui';
import { useTheme } from '@/design';
import { t } from '@/i18n';
import { goBackOr } from '@/lib/navigation';

import { getCategory, groupLabel, presetTaskCount } from './index';
import type { CatalogGroup, CatalogPreset, CatalogScope } from './types';

export type IconName = ComponentProps<typeof Ionicons>['name'];

export function countLabel(count: number, one: string, many: string): string {
  return count === 1 ? one : many.replace('{count}', String(count));
}

export function CatalogBackLink() {
  const theme = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      onPress={() => goBackOr('/(app)/(tabs)/templates')}
      hitSlop={12}
      style={{ alignSelf: 'flex-start', minHeight: 32, justifyContent: 'center' }}
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
  );
}

export function ScopeChips({
  scope,
  onChange,
}: {
  scope: CatalogScope;
  onChange: (scope: CatalogScope) => void;
}) {
  const options: [CatalogScope, string][] = [
    ['home', getCategory('home').label],
    ['kitchen', getCategory('kitchen').label],
    ['all', t().catalog.scopeAll],
  ];
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
      {options.map(([key, label]) => (
        <Chip
          key={key}
          label={label}
          selected={scope === key}
          onPress={() => onChange(key)}
        />
      ))}
    </View>
  );
}

export function CatalogSearchField({
  value,
  onChangeText,
}: {
  value: string;
  onChangeText: (value: string) => void;
}) {
  const theme = useTheme();
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        minHeight: 48,
        paddingHorizontal: theme.space.md,
        gap: theme.space.sm,
        borderRadius: theme.radii.sm,
        borderWidth: 1,
        borderColor: theme.colors.border,
        backgroundColor: theme.colors.white,
      }}
    >
      <Ionicons name="search" size={18} color={theme.colors.inkSubtle} />
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={t().catalog.searchPlaceholder}
        placeholderTextColor={theme.colors.inkSubtle}
        returnKeyType="search"
        autoCorrect={false}
        allowFontScaling
        style={{
          flex: 1,
          minHeight: 44,
          fontFamily: theme.fonts.body,
          fontSize: theme.typography.body.fontSize,
          color: theme.colors.ink,
          includeFontPadding: false,
        }}
      />
      {value ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t().common.cancel}
          onPress={() => onChangeText('')}
          hitSlop={10}
        >
          <Ionicons name="close-circle" size={18} color={theme.colors.inkSubtle} />
        </Pressable>
      ) : null}
    </View>
  );
}

export function GroupCard({
  group,
  onPress,
}: {
  group: CatalogGroup;
  onPress: () => void;
}) {
  const theme = useTheme();
  const copy = t().catalog;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={group.label}
      onPress={onPress}
      style={({ pressed }) => ({
        width: '48%',
        minHeight: 116,
        padding: theme.space.md,
        marginBottom: theme.space.md,
        borderRadius: theme.radii.md,
        borderWidth: 1,
        borderColor: theme.colors.border,
        backgroundColor: theme.colors.white,
        justifyContent: 'space-between',
        gap: theme.space.sm,
        opacity: pressed ? 0.85 : 1,
      })}
    >
      <View
        style={{
          width: 40,
          height: 40,
          borderRadius: 20,
          backgroundColor: theme.colors.sand,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Ionicons
          name={group.icon as IconName}
          size={20}
          color={theme.colors.primary}
        />
      </View>
      <View style={{ gap: 2 }}>
        <Text
          style={{
            fontFamily: theme.fonts.bodySemiBold,
            fontSize: theme.typography.bodySmall.fontSize,
            lineHeight: theme.typography.bodySmall.lineHeight,
            color: theme.colors.ink,
          }}
          numberOfLines={2}
          allowFontScaling
        >
          {group.label}
        </Text>
        <Text
          style={{
            fontFamily: theme.fonts.body,
            fontSize: theme.typography.caption.fontSize,
            color: theme.colors.inkMuted,
          }}
          allowFontScaling
        >
          {countLabel(
            group.presetIds.length,
            copy.templateCountOne,
            copy.templateCount,
          )}
        </Text>
      </View>
    </Pressable>
  );
}

export function PresetRow({
  preset,
  showContext = false,
  onPress,
}: {
  preset: CatalogPreset;
  /** Adds category and group so similar results can be told apart. */
  showContext?: boolean;
  onPress: () => void;
}) {
  const theme = useTheme();
  const tasks = t().catalog.taskCount.replace(
    '{count}',
    String(presetTaskCount(preset)),
  );
  const context = showContext
    ? `${getCategory(preset.category).label} · ${groupLabel(preset.group)} · `
    : '';
  return (
    <ListRow
      title={preset.title}
      subtitle={`${context}${preset.cadence} · ${tasks}`}
      onPress={onPress}
      right={
        <Ionicons
          name="chevron-forward"
          size={18}
          color={theme.colors.inkSubtle}
        />
      }
    />
  );
}