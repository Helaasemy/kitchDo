import type { ComponentProps } from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';

import { BackLink, ListRow } from '@/components/ui';
import { useTheme, type AppTheme } from '@/design';
import type { TaskFrequency } from '@/features/recurring/period';
import { useT } from '@/i18n';

import { findGroup, getCategory, groupLabel, presetTaskCount } from './index';
import type { CatalogGroup, CatalogPreset, CatalogScope } from './types';

export type IconName = ComponentProps<typeof Ionicons>['name'];

export function countLabel(count: number, one: string, many: string): string {
  return count === 1 ? one : many.replace('{count}', String(count));
}

export function CatalogBackLink() {
  const t = useT();
  return <BackLink label={t().tabs.templates} fallback="/(app)/(tabs)/templates" />;
}

/** Segmented Home / Kitchen / All control. */
export function ScopeChips({
  scope,
  onChange,
}: {
  scope: CatalogScope;
  onChange: (scope: CatalogScope) => void;
}) {
  const t = useT();
  const theme = useTheme();
  const options: [CatalogScope, string][] = [
    ['home', getCategory('home').label],
    ['kitchen', getCategory('kitchen').label],
    ['all', t().catalog.scopeAllShort],
  ];
  return (
    <View
      accessibilityRole="tablist"
      style={{
        flexDirection: 'row',
        padding: 4,
        borderRadius: theme.radii.pill,
        borderWidth: 0.5,
        borderColor: theme.colors.border,
        backgroundColor: theme.colors.sand,
      }}
    >
      {options.map(([key, label]) => {
        const selected = scope === key;
        return (
          <Pressable
            key={key}
            accessibilityRole="tab"
            accessibilityState={{ selected }}
            onPress={() => onChange(key)}
            style={{
              flex: 1,
              minHeight: 40,
              borderRadius: theme.radii.pill,
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: selected ? theme.colors.primary : 'transparent',
              boxShadow: selected ? theme.shadows.soft : undefined,
            }}
          >
            <Text
              style={{
                fontFamily: theme.fonts.bodyExtraBold,
                fontSize: theme.typography.caption.fontSize,
                color: selected ? '#FFFFFF' : theme.colors.inkMuted,
              }}
              allowFontScaling
            >
              {label}
            </Text>
          </Pressable>
        );
      })}
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
  const t = useT();
  const theme = useTheme();
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        minHeight: 56,
        paddingHorizontal: theme.space.lg,
        gap: theme.space.sm,
        borderRadius: theme.radii.lg,
        borderWidth: 0.5,
        borderColor: theme.colors.border,
        backgroundColor: theme.colors.white,
      }}
    >
      <Ionicons name="search-outline" size={20} color={theme.colors.inkMuted} />
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
          minHeight: 48,
          fontFamily: theme.fonts.bodyMedium,
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

/** Tints for category icons, cycled so neighbours differ. */
function groupTint(theme: AppTheme, index: number): {
  background: string;
  color: string;
} {
  const f = theme.colors.frequency;
  const tints = [
    { background: f.daily.tint, color: f.daily.text },
    { background: f.monthly.tint, color: f.monthly.text },
    { background: f.weekly.tint, color: f.weekly.text },
    { background: theme.colors.primaryTint, color: theme.colors.primary },
    { background: theme.colors.sand, color: theme.colors.inkMuted },
    { background: theme.colors.alertTint, color: theme.colors.coral },
  ];
  return tints[index % tints.length];
}

export function GroupCard({
  group,
  index = 0,
  onPress,
}: {
  group: CatalogGroup;
  index?: number;
  onPress: () => void;
}) {
  const t = useT();
  const theme = useTheme();
  const copy = t().catalog;
  const tint = groupTint(theme, index);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={group.label}
      onPress={onPress}
      style={({ pressed }) => ({
        width: '48.5%',
        minHeight: 128,
        padding: theme.space.lg,
        marginBottom: theme.space.md,
        borderRadius: theme.radii.xl,
        borderWidth: 0.5,
        borderColor: theme.colors.border,
        backgroundColor: theme.colors.card,
        boxShadow: theme.shadows.soft,
        justifyContent: 'space-between',
        gap: theme.space.lg,
        transform: [{ scale: pressed ? 0.98 : 1 }],
      })}
    >
      <View
        style={{
          width: 40,
          height: 40,
          borderRadius: 20,
          backgroundColor: tint.background,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Ionicons name={group.icon as IconName} size={20} color={tint.color} />
      </View>
      <View style={{ gap: 4 }}>
        <Text
          style={{
            fontFamily: theme.fonts.bodyExtraBold,
            fontSize: 15,
            lineHeight: 19,
            color: theme.colors.ink,
          }}
          numberOfLines={2}
          allowFontScaling
        >
          {group.label}
        </Text>
        <Text
          style={{
            fontFamily: theme.fonts.bodyMedium,
            fontSize: theme.typography.label.fontSize,
            color: theme.colors.inkMuted,
          }}
          allowFontScaling
        >
          {countLabel(group.presetIds.length, copy.templateCountOne, copy.templateCount)}
        </Text>
      </View>
    </Pressable>
  );
}

export function FrequencyPill({ frequency }: { frequency: TaskFrequency | null }) {
  const t = useT();
  const theme = useTheme();
  const copy = t().recurring;
  const accent = frequency ? theme.colors.frequency[frequency] : null;
  return (
    <View
      style={{
        alignSelf: 'flex-start',
        paddingHorizontal: theme.space.md,
        paddingVertical: 4,
        borderRadius: theme.radii.pill,
        backgroundColor: accent?.tint ?? theme.colors.sand,
      }}
    >
      <Text
        style={{
          fontFamily: theme.fonts.label,
          fontSize: 10,
          lineHeight: 13,
          letterSpacing: 0.8,
          textTransform: 'uppercase',
          color: accent?.text ?? theme.colors.inkMuted,
        }}
        allowFontScaling
      >
        {frequency ? copy[frequency] : copy.oneOff}
      </Text>
    </View>
  );
}

/** Wide card for the Popular row. */
export function PresetCard({
  preset,
  onPress,
}: {
  preset: CatalogPreset;
  onPress: () => void;
}) {
  const t = useT();
  const theme = useTheme();
  const icon = (findGroup(preset.group)?.group.icon ?? 'list-outline') as IconName;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={preset.title}
      onPress={onPress}
      style={({ pressed }) => ({
        width: 220,
        padding: theme.space.xl - 4,
        gap: theme.space.lg,
        borderRadius: theme.radii.xxl,
        backgroundColor: theme.colors.white,
        boxShadow: theme.shadows.raised,
        transform: [{ scale: pressed ? 0.98 : 1 }],
      })}
    >
      <View
        style={{
          width: 48,
          height: 48,
          borderRadius: theme.radii.lg,
          backgroundColor: theme.colors.canvas,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Ionicons name={icon} size={22} color={theme.colors.primary} />
      </View>
      <View style={{ gap: 4 }}>
        <Text
          style={{
            fontFamily: theme.fonts.bodyExtraBold,
            fontSize: theme.typography.cardTitle.fontSize,
            lineHeight: theme.typography.cardTitle.lineHeight,
            color: theme.colors.ink,
          }}
          numberOfLines={2}
          allowFontScaling
        >
          {preset.title}
        </Text>
        <Text
          style={{
            fontFamily: theme.fonts.bodyMedium,
            fontSize: theme.typography.caption.fontSize,
            color: theme.colors.inkMuted,
          }}
          allowFontScaling
        >
          {t().catalog.taskCount.replace('{count}', String(presetTaskCount(preset)))}
        </Text>
      </View>
      <FrequencyPill frequency={preset.frequency} />
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
  const t = useT();
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
      right={<FrequencyPill frequency={preset.frequency} />}
    />
  );
}
