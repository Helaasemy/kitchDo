import { Stack } from 'expo-router';

import { useTheme } from '@/design';

export default function OnboardingLayout() {
  const theme = useTheme();

  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: theme.colors.canvas },
        animation: theme.reduceMotion ? 'none' : 'fade',
      }}
    />
  );
}
