import type { ReactNode } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, View } from 'react-native';

import { Screen, Wordmark } from '@/components/ui';
import { useTheme } from '@/design';

import { AuthModeToggle, type AuthMode } from './AuthModeToggle';

export function AuthShell({
  mode,
  onBeforeChange,
  children,
}: {
  mode: AuthMode;
  onBeforeChange?: () => void | Promise<void>;
  children: ReactNode;
}) {
  const theme = useTheme();

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: theme.colors.canvas }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <Screen
        contentStyle={{
          paddingHorizontal: theme.space.xxl,
          paddingTop: theme.space.md,
          paddingBottom: 0,
        }}
      >
        <View style={{ alignItems: 'center', marginBottom: theme.space.md }}>
          <Wordmark size="lg" />
        </View>
        <View style={{ marginBottom: theme.space.lg }}>
          <AuthModeToggle value={mode} onBeforeChange={onBeforeChange} />
        </View>
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={{
            flexGrow: 1,
            paddingBottom: theme.space.xxl,
          }}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="interactive"
          automaticallyAdjustKeyboardInsets
          showsVerticalScrollIndicator={false}
        >
          {children}
        </ScrollView>
      </Screen>
    </KeyboardAvoidingView>
  );
}
