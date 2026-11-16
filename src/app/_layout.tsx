import { memo, useEffect, useMemo } from 'react';
import { Platform, View } from 'react-native';
import { LocaleProvider, Stack, router, useSegments } from 'expo-router';
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
import { PurchasesSync } from '@/features/billing/PurchasesSync';
import { CatalogProvider } from '@/features/catalog';
import { I18nProvider, useI18n } from '@/i18n';
import { ReminderResponseBridge } from '@/features/runs/ReminderResponseBridge';
import { SyncProvider } from '@/lib/sync';

export { ErrorBoundary } from 'expo-router';

SplashScreen.preventAutoHideAsync().catch(() => undefined);

export const unstable_settings = {
  anchor: 'index',
};

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

/**
 * Signup/login live inside a Protected group. When the session appears that
 * group unmounts; Expo does not always land on onboarding/app, which shows a
 * blank screen until the next cold start. Drive the handoff from here so it
 * still runs after (auth) is gone.
 */
const AuthRouteSync = memo(function AuthRouteSync() {
  const { status, recoveryPending, pendingJoinCode, completingJoin } = useAuth();
  const root = useSegments()[0];

  useEffect(() => {
    if (recoveryPending || completingJoin) return;
    if (status === 'loading' || status === 'misconfigured') return;

    const inAuth = root === '(auth)';
    const inOnboarding = root === '(onboarding)';
    const inApp = root === '(app)';
    const inJoin = root === 'join';
    const inCallback = root === 'auth';

    if (status === 'unauthenticated') {
      if (!inAuth && !inJoin && !inCallback) router.replace('/(auth)/login');
      return;
    }
    if (status === 'offline_unknown') {
      if (root) router.replace('/');
      return;
    }
    if (status === 'needs_onboarding') {
      if (inJoin || inOnboarding) return;
      router.replace(pendingJoinCode ? '/join' : '/(onboarding)');
      return;
    }
    if (status === 'authenticated' && !inApp && !inJoin) {
      router.replace('/(app)/(tabs)/today');
    }
  }, [status, recoveryPending, pendingJoinCode, completingJoin, root]);

  return null;
});

const RootNavigator = memo(function RootNavigator() {
  const { status, recoveryPending, pendingJoinCode } = useAuth();
  const { direction } = useI18n();
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
    status === 'loading' ||
    recoveryPending;
  const showOnboarding = status === 'needs_onboarding' && !recoveryPending;
  const showApp = status === 'authenticated' && !recoveryPending;
  const afterAuthHref =
    status === 'offline_unknown'
      ? '/'
      : showOnboarding
        ? pendingJoinCode
          ? '/join'
          : '/(onboarding)'
        : '/(app)/(tabs)/today';

  return (
    <LocaleProvider direction={direction}>
      <AuthRouteSync />
      <View
        style={{ flex: 1, backgroundColor: theme.colors.canvas }}
        {...(Platform.OS === 'web'
          ? ({ dir: direction } as { dir: 'ltr' | 'rtl' })
          : null)}
      >
        <Stack screenOptions={screenOptions}>
          <Stack.Screen name="index" />
          <Stack.Screen name="join" options={{ animation: 'none' }} />

          <Stack.Protected guard={showAuth} redirectTo={afterAuthHref}>
            <Stack.Screen name="(auth)" />
          </Stack.Protected>

          <Stack.Protected
            guard={showOnboarding}
            redirectTo={showApp ? '/(app)/(tabs)/today' : '/(auth)/login'}
          >
            <Stack.Screen name="(onboarding)" />
          </Stack.Protected>

          <Stack.Protected guard={showApp} redirectTo="/(auth)/login">
            <Stack.Screen name="(app)" />
          </Stack.Protected>

          <Stack.Screen name="auth/callback" options={{ headerShown: false }} />
        </Stack>
      </View>
    </LocaleProvider>
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
          <I18nProvider>
            <CatalogProvider>
              <AuthProvider>
                <PurchasesSync />
                <SyncProvider>
                  <SplashController />
                  <ReminderResponseBridge />
                  <RootNavigator />
                </SyncProvider>
              </AuthProvider>
            </CatalogProvider>
          </I18nProvider>
        </ThemeProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
