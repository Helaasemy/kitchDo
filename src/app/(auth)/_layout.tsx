import { Stack } from 'expo-router';

import { useTheme } from '@/design';

export default function AuthLayout() {
  const theme = useTheme();

  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: theme.colors.canvas },
        animation: theme.reduceMotion ? 'none' : 'slide_from_right',
      }}
    />
  );
}
