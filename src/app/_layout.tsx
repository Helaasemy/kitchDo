import { memo, useEffect, useMemo } from 'react';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useFonts } from 'expo-font';
import {
  InstrumentSerif_400Regular,
  InstrumentSerif_400Regular_Italic,
} from '@expo-google-fonts/instrument-serif';
import {
  PlusJakartaSans_400Regular,
  PlusJakartaSans_500Medium,
  PlusJakartaSans_600SemiBold,
  PlusJakartaSans_700Bold,
  PlusJakartaSans_800ExtraBold,
} from '@expo-google-fonts/plus-jakarta-sans';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { ThemeProvider, useTheme } from '@/design';
import { AuthProvider, useAuth } from '@/features/auth';
import { ReminderResponseBridge } from '@/features/runs/ReminderResponseBridge';
import { SyncProvider } from '@/lib/sync';

export { ErrorBoundary } from 'expo-router';

SplashScreen.preventAutoHideAsync().catch(() => undefined);

const SplashController = memo(function SplashController() {
  const { status } = useAuth();
  const ready = status !== 'loading';

  useEffect(() => {
    if (ready) {
      SplashScreen.hideAsync().catch(() => undefined);
    }
  }, [ready]);

  return null;
});

const RootNavigator = memo(function RootNavigator() {
  const { status } = useAuth();
  const theme = useTheme();

  // Must be stable — a new screenOptions object each render makes
  // React Navigation update state → re-render → max update depth.
  const screenOptions = useMemo(
    () => ({
      headerShown: false,
      contentStyle: { backgroundColor: theme.colors.canvas },
      animation: theme.reduceMotion ? ('none' as const) : ('fade' as const),
    }),
    [theme.colors.canvas, theme.reduceMotion],
  );

  const showAuth =
    status === 'misconfigured' ||
    status === 'unauthenticated' ||
    status === 'loading';
  const showOnboarding = status === 'needs_onboarding';
  const showApp = status === 'authenticated';

  return (
    <Stack screenOptions={screenOptions}>
      <Stack.Screen name="index" />

      <Stack.Protected guard={showAuth}>
        <Stack.Screen name="(auth)" />
      </Stack.Protected>

      <Stack.Protected guard={showOnboarding}>
        <Stack.Screen name="(onboarding)" />
      </Stack.Protected>

      <Stack.Protected guard={showApp}>
        <Stack.Screen name="(app)" />
      </Stack.Protected>

      <Stack.Screen name="auth/callback" options={{ headerShown: false }} />
    </Stack>
  );
});

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    InstrumentSerif_400Regular,
    InstrumentSerif_400Regular_Italic,
    PlusJakartaSans_400Regular,
    PlusJakartaSans_500Medium,
    PlusJakartaSans_600SemiBold,
    PlusJakartaSans_700Bold,
    PlusJakartaSans_800ExtraBold,
  });

  useEffect(() => {
    if (fontError) {
      SplashScreen.hideAsync().catch(() => undefined);
    }
  }, [fontError]);

  if (!fontsLoaded && !fontError) {
    return null;
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <ThemeProvider>
          <AuthProvider>
            <SyncProvider>
              <SplashController />
              <ReminderResponseBridge />
              <RootNavigator />
            </SyncProvider>
          </AuthProvider>
        </ThemeProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
