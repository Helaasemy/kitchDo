import { useCallback, useMemo } from 'react';
import { type ColorValue } from 'react-native';
import { Tabs } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useTheme } from '@/design';
import { t } from '@/i18n';

type TabIconProps = {
  focused: boolean;
  color: ColorValue;
  size: number;
};

export default function AppTabsLayout() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const tabs = t().tabs;
  const bottomPad = Math.max(insets.bottom, 12);
  const tabBarHeight = 56 + bottomPad;

  const screenOptions = useMemo(
    () => ({
      headerShown: false,
      tabBarActiveTintColor: theme.colors.primary,
      tabBarInactiveTintColor: theme.colors.inkSubtle,
      tabBarStyle: {
        backgroundColor: theme.colors.canvas,
        borderTopColor: theme.colors.border,
        borderTopWidth: 1,
        height: tabBarHeight,
        paddingTop: 6,
        paddingBottom: bottomPad,
      },
      tabBarItemStyle: {
        paddingVertical: 2,
      },
      tabBarLabelStyle: {
        fontFamily: theme.fonts.label,
        fontSize: 11,
        lineHeight: 14,
        marginTop: 2,
      },
      tabBarIconStyle: {
        marginTop: 2,
      },
      animation: theme.reduceMotion ? ('none' as const) : ('shift' as const),
    }),
    [
      theme.colors.primary,
      theme.colors.inkSubtle,
      theme.colors.canvas,
      theme.colors.border,
      theme.fonts.label,
      theme.reduceMotion,
      tabBarHeight,
      bottomPad,
    ],
  );

  const todayIcon = useCallback(
    ({ color, size }: TabIconProps) => (
      <Ionicons name="sunny-outline" color={String(color)} size={size} />
    ),
    [],
  );
  const templatesIcon = useCallback(
    ({ color, size }: TabIconProps) => (
      <Ionicons name="list-outline" color={String(color)} size={size} />
    ),
    [],
  );
  const historyIcon = useCallback(
    ({ color, size }: TabIconProps) => (
      <Ionicons name="time-outline" color={String(color)} size={size} />
    ),
    [],
  );

  return (
    <Tabs screenOptions={screenOptions}>
      <Tabs.Screen
        name="today"
        options={{ title: tabs.today, tabBarIcon: todayIcon }}
      />
      <Tabs.Screen
        name="templates"
        options={{
          title: tabs.templates,
          headerShown: false,
          tabBarIcon: templatesIcon,
        }}
      />
      <Tabs.Screen
        name="history"
        options={{ title: tabs.history, tabBarIcon: historyIcon }}
      />
    </Tabs>
  );
}
