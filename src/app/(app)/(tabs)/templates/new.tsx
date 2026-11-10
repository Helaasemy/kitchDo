import { useEffect } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { router } from 'expo-router';

import { Screen } from '@/components/ui';
import { useTheme } from '@/design';
import { useAuth } from '@/features/auth';
import { newId } from '@/lib/ids';

/** Allocates a client UUID then opens the builder for a brand-new draft. */
export default function NewTemplateScreen() {
  const theme = useTheme();
  const { canEditTemplates } = useAuth();

  useEffect(() => {
    if (!canEditTemplates) {
      router.replace('/(app)/(tabs)/templates');
      return;
    }
    const id = newId();
    router.replace(`/(app)/(tabs)/templates/${id}`);
  }, [canEditTemplates]);

  return (
    <Screen>
      <View
        style={{
          flex: 1,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <ActivityIndicator color={theme.colors.primary} />
      </View>
    </Screen>
  );
}
