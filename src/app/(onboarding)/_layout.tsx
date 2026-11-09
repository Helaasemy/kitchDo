import { useMemo } from 'react';
import { Stack } from 'expo-router';

import { useTheme } from '@/design';

export default function OnboardingLayout() {
  const theme = useTheme();

  const screenOptions = useMemo(
    () => ({
      headerShown: false,
      contentStyle: { backgroundColor: theme.colors.canvas },
      animation: theme.reduceMotion ? ('none' as const) : ('fade' as const),
    }),
    [theme.colors.canvas, theme.reduceMotion],
  );

  return <Stack screenOptions={screenOptions} />;
}
