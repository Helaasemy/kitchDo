import { Pressable, Text, View } from 'react-native';

import { useTheme } from '@/design';

export type FrequencyTab<K extends string> = { key: K; label: string; badge?: string };

/** Segmented tabs: All plus the frequencies that have tasks. */
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
    <View
      accessibilityRole="tablist"
      style={{
        flexDirection: 'row',
        padding: 4,
        gap: 4,
        borderRadius: theme.radii.sm,
        borderWidth: 1,
        borderColor: theme.colors.border,
        backgroundColor: theme.colors.white,
      }}
    >
      {tabs.map((tab) => {
        const selected = tab.key === value;
        return (
          <Pressable
            key={tab.key}
            accessibilityRole="tab"
            accessibilityState={{ selected }}
            onPress={() => onChange(tab.key)}
            style={{
              flex: 1,
              minHeight: 40,
              paddingHorizontal: 4,
              borderRadius: theme.radii.sm - 2,
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: selected ? theme.colors.primary : 'transparent',
            }}
          >
            <Text
              numberOfLines={1}
              style={{
                fontFamily: theme.fonts.bodyMedium,
                fontSize: theme.typography.bodySmall.fontSize,
                color: selected ? '#FFFFFF' : theme.colors.inkMuted,
              }}
              allowFontScaling
            >
              {tab.label}
            </Text>
            {tab.badge ? (
              <Text
                numberOfLines={1}
                style={{
                  fontFamily: theme.fonts.body,
                  fontSize: theme.typography.caption.fontSize,
                  color: selected ? 'rgba(255, 255, 255, 0.85)' : theme.colors.inkSubtle,
                }}
                allowFontScaling
              >
                {tab.badge}
              </Text>
            ) : null}
          </Pressable>
        );
      })}
    </View>
  );
}
