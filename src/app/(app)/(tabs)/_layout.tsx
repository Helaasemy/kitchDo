import { useCallback, useMemo, type ComponentProps } from 'react';
import { View, type ColorValue } from 'react-native';
import { Tabs } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useTheme } from '@/design';
import { useT } from '@/i18n';

type IconName = ComponentProps<typeof Ionicons>['name'];

type TabIconProps = {
  focused: boolean;
  color: ColorValue;
  size: number;
};

function TabIcon({
  focused,
  color,
  active,
  inactive,
}: TabIconProps & { active: IconName; inactive: IconName }) {
  return (
    <View style={{ alignItems: 'center', gap: 3 }}>
      <Ionicons name={focused ? active : inactive} color={String(color)} size={24} />
      <View
        style={{
          width: 4,
          height: 4,
          borderRadius: 2,
          backgroundColor: focused ? String(color) : 'transparent',
        }}
      />
    </View>
  );
}

export default function AppTabsLayout() {
  const t = useT();
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const tabs = t().tabs;
  const bottomPad = Math.max(insets.bottom, 12);
  const tabBarHeight = 64 + bottomPad;

  const screenOptions = useMemo(
    () => ({
      headerShown: false,
      tabBarActiveTintColor: theme.colors.primary,
      tabBarInactiveTintColor: theme.colors.inkMuted,
      tabBarStyle: {
        backgroundColor: theme.colors.canvas,
        borderTopColor: theme.colors.border,
        borderTopWidth: 0.5,
        height: tabBarHeight,
        paddingTop: 8,
        paddingBottom: bottomPad,
        boxShadow: theme.shadows.soft,
      },
      tabBarItemStyle: {
        paddingVertical: 2,
      },
      tabBarLabelStyle: {
        fontFamily: theme.fonts.label,
        fontSize: 10,
        lineHeight: 13,
        letterSpacing: 0.4,
        textTransform: 'uppercase' as const,
        marginTop: 2,
      },
      tabBarIconStyle: {
        marginTop: 2,
      },
      animation: theme.reduceMotion ? ('none' as const) : ('shift' as const),
    }),
    [
      theme.colors.primary,
      theme.colors.inkMuted,
      theme.colors.canvas,
      theme.colors.border,
      theme.shadows.soft,
      theme.fonts.label,
      theme.reduceMotion,
      tabBarHeight,
      bottomPad,
    ],
  );

  const todayIcon = useCallback(
    (props: TabIconProps) => <TabIcon {...props} active="sunny" inactive="sunny-outline" />,
    [],
  );
  const templatesIcon = useCallback(
    (props: TabIconProps) => <TabIcon {...props} active="list" inactive="list-outline" />,
    [],
  );
  const historyIcon = useCallback(
    (props: TabIconProps) => <TabIcon {...props} active="time" inactive="time-outline" />,
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
