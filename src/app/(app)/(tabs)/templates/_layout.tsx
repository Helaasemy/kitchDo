import { useMemo } from 'react';
import { Stack } from 'expo-router';

import { useTheme } from '@/design';

export const unstable_settings = {
  anchor: 'index',
};

export default function TemplatesStackLayout() {
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
      <Stack.Screen name="index" />
      <Stack.Screen name="new" />
      <Stack.Screen name="catalog/index" />
      <Stack.Screen name="catalog/group/[groupId]" />
      <Stack.Screen name="catalog/preset/[presetId]" />
      <Stack.Screen name="[id]/index" />
      <Stack.Screen name="[id]/hub" />
      <Stack.Screen name="[id]/schedule" />
    </Stack>
  );
}
