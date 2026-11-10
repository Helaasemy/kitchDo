import { Pressable, ScrollView, Text } from 'react-native';

import { useTheme } from '@/design';

import { isTaskFrequency } from './period';

export type FrequencyTab<K extends string> = { key: K; label: string; badge?: string };

/** Pill tabs: All plus the frequencies that have tasks, each in its own tint. */
export function FrequencyTabs<K extends string>({
  tabs,
  value,
  onChange,
}: {
  tabs: FrequencyTab<K>[];
  value: K;
  onChange: (key: K) => void;
}) {
  const theme = useTheme();
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      accessibilityRole="tablist"
      style={{ marginHorizontal: -theme.space.screen, flexGrow: 0 }}
      contentContainerStyle={{ gap: theme.space.sm, paddingHorizontal: theme.space.screen }}
    >
      {tabs.map((tab) => {
        const selected = tab.key === value;
        const accent = isTaskFrequency(tab.key) ? theme.colors.frequency[tab.key] : null;
        const background = selected ? theme.colors.ink : (accent?.tint ?? theme.colors.sand);
        const color = selected ? theme.colors.canvas : (accent?.text ?? theme.colors.ink);
        return (
          <Pressable
            key={tab.key}
            accessibilityRole="tab"
            accessibilityState={{ selected }}
            onPress={() => onChange(tab.key)}
            style={({ pressed }) => ({
              minHeight: 40,
              paddingHorizontal: theme.space.lg,
              borderRadius: theme.radii.pill,
              flexDirection: 'row',
              alignItems: 'center',
              gap: 6,
              backgroundColor: background,
              opacity: pressed ? 0.85 : 1,
            })}
          >
            <Text
              numberOfLines={1}
              style={{
                fontFamily: theme.fonts.bodyExtraBold,
                fontSize: theme.typography.caption.fontSize,
                color,
              }}
              allowFontScaling
            >
              {tab.label}
            </Text>
            {tab.badge ? (
              <Text
                numberOfLines={1}
                style={{
                  fontFamily: theme.fonts.bodyBold,
                  fontSize: theme.typography.label.fontSize,
                  color,
                  opacity: 0.7,
                }}
                allowFontScaling
              >
                {tab.badge}
              </Text>
            ) : null}
          </Pressable>
        );
      })}
    </ScrollView>
  );
}
