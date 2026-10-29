import { Stack } from 'expo-router';

import { useTheme } from '@/design';

export default function TemplatesStackLayout() {
  const theme = useTheme();

  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: theme.colors.canvas },
        animation: theme.reduceMotion ? 'none' : 'slide_from_right',
      }}
    >
      <Stack.Screen name="index" />
      <Stack.Screen name="new" />
      <Stack.Screen name="[id]/index" />
      <Stack.Screen name="[id]/hub" />
      <Stack.Screen name="[id]/schedule" />
    </Stack>
  );
}
