import { Redirect } from 'expo-router';
import { ActivityIndicator, View } from 'react-native';

import { useTheme } from '@/design';
import { useAuth } from '@/features/auth';

export default function Index() {
  const { status } = useAuth();
  const theme = useTheme();

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

  if (status === 'misconfigured' || status === 'unauthenticated') {
    return <Redirect href="/(auth)/login" />;
  }

  if (status === 'needs_onboarding') {
    return <Redirect href="/(onboarding)" />;
  }

  return <Redirect href="/(app)/(tabs)/today" />;
}
