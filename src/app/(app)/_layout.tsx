import { useMemo } from 'react';
import { Stack } from 'expo-router';

import { useTheme } from '@/design';

export default function AppStackLayout() {
  const theme = useTheme();

  const screenOptions = useMemo(
    () => ({
      headerShown: false,
      contentStyle: { backgroundColor: theme.colors.canvas },
      animation: theme.reduceMotion
        ? ('none' as const)
        : ('slide_from_right' as const),
    }),
    [theme.colors.canvas, theme.reduceMotion],
  );

  return (
    <Stack screenOptions={screenOptions}>
      <Stack.Screen name="(tabs)" />
      <Stack.Screen name="runs/[id]" options={{ title: 'Run' }} />
      <Stack.Screen name="settings" options={{ title: 'Settings' }} />
    </Stack>
  );
}
