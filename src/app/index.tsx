import { Redirect } from 'expo-router';
import { ActivityIndicator, Text, View } from 'react-native';

import { Button, Screen } from '@/components/ui';
import { useTheme } from '@/design';
import { useAuth } from '@/features/auth';
import { useT } from '@/i18n';

export default function Index() {
  const t = useT();
  const { status, recoveryPending, refreshOnboarding } = useAuth();
  const theme = useTheme();
  const copy = t().auth;

  if (status === 'loading') {
    return (
      <View
        style={{
          flex: 1,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: theme.colors.canvas,
        }}
      >
        <ActivityIndicator color={theme.colors.primary} />
      </View>
    );
  }

  if (recoveryPending) {
    return <Redirect href="/auth/callback" />;
  }

  if (status === 'misconfigured' || status === 'unauthenticated') {
    return <Redirect href="/(auth)/login" />;
  }

  if (status === 'offline_unknown') {
    return (
      <Screen>
        <View
          style={{
            flex: 1,
            justifyContent: 'center',
            gap: theme.space.lg,
          }}
        >
          <Text
            accessibilityRole="header"
            style={{
              fontFamily: theme.fonts.display,
              fontSize: theme.typography.title.fontSize,
              color: theme.colors.ink,
            }}
            allowFontScaling
          >
            {copy.offlineUnknownTitle}
          </Text>
          <Text
            style={{
              fontFamily: theme.fonts.body,
              fontSize: theme.typography.body.fontSize,
              color: theme.colors.inkMuted,
            }}
            allowFontScaling
          >
            {copy.offlineUnknownBody}
          </Text>
          <Button
            label={t().common.retry}
            onPress={() => void refreshOnboarding()}
          />
        </View>
      </Screen>
    );
  }

  if (status === 'needs_onboarding') {
    return <Redirect href="/(onboarding)" />;
  }

  return <Redirect href="/(app)/(tabs)/today" />;
}
