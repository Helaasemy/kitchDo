import { Tabs } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useTheme } from '@/design';
import { t } from '@/i18n';

export default function AppTabsLayout() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const tabs = t().tabs;
  const bottomPad = Math.max(insets.bottom, 12);
  const tabBarHeight = 56 + bottomPad;

  return (
    <Tabs
      screenOptions={{
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
        animation: theme.reduceMotion ? 'none' : 'shift',
      }}
    >
      <Tabs.Screen
        name="today"
        options={{
          title: tabs.today,
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="sunny-outline" color={String(color)} size={size} />
          ),
        }}
      />
      <Tabs.Screen
        name="templates"
        options={{
          title: tabs.templates,
          headerShown: false,
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="list-outline" color={String(color)} size={size} />
          ),
        }}
      />
      <Tabs.Screen
        name="history"
        options={{
          title: tabs.history,
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="time-outline" color={String(color)} size={size} />
          ),
        }}
      />
    </Tabs>
  );
}
