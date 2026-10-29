import { useState } from 'react';
import { Link, router } from 'expo-router';
import { Pressable, Text, View } from 'react-native';

import { BrandMark, Button, Screen, TextField } from '@/components/ui';
import { useTheme } from '@/design';
import { useAuth } from '@/features/auth';
import { t } from '@/i18n';

export default function SignupScreen() {
  const theme = useTheme();
  const { signUp } = useAuth();
  const copy = t().auth;
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const onSubmit = async () => {
    setError(null);
    if (!email.trim()) {
      setError(copy.emailRequired);
      return;
    }
    if (password.length < 8) {
      setError(copy.passwordTooShort);
      return;
    }
    setLoading(true);
    const result = await signUp(email, password);
    setLoading(false);
    if (result.error) {
      setError(result.error);
      return;
    }
    router.replace('/');
  };

  return (
    <Screen scroll>
      <View style={{ marginTop: theme.space.xxl, gap: theme.space.xl }}>
        <BrandMark size="lg" />
        <View style={{ gap: theme.space.sm }}>
          <Text
            style={{
              fontFamily: theme.fonts.display,
              fontSize: theme.typography.title.fontSize,
              lineHeight: theme.typography.title.lineHeight,
              color: theme.colors.ink,
            }}
            allowFontScaling
          >
            {copy.signupTitle}
          </Text>
          <Text
            style={{
              fontFamily: theme.fonts.body,
              fontSize: theme.typography.body.fontSize,
              lineHeight: theme.typography.body.lineHeight,
              color: theme.colors.inkMuted,
            }}
            allowFontScaling
          >
            {copy.signupSubtitle}
          </Text>
        </View>

        <View style={{ gap: theme.space.md }}>
          <TextField
            label={t().common.email}
            autoCapitalize="none"
            autoComplete="email"
            keyboardType="email-address"
            textContentType="emailAddress"
            value={email}
            onChangeText={setEmail}
          />
          <TextField
            label={t().common.password}
            secureTextEntry
            autoComplete="new-password"
            textContentType="newPassword"
            value={password}
            onChangeText={setPassword}
          />
          {error ? (
            <Text
              style={{
                fontFamily: theme.fonts.body,
                color: theme.colors.coral,
                fontSize: theme.typography.caption.fontSize,
              }}
              allowFontScaling
            >
              {error}
            </Text>
          ) : null}
          <Button label={copy.signupAction} onPress={onSubmit} loading={loading} />
          <Link href="/(auth)/login" asChild>
            <Pressable accessibilityRole="link" style={{ paddingVertical: theme.space.sm }}>
              <Text
                style={{
                  fontFamily: theme.fonts.body,
                  color: theme.colors.inkMuted,
                  fontSize: theme.typography.bodySmall.fontSize,
                  textAlign: 'center',
                }}
                allowFontScaling
              >
                {copy.haveAccount}{' '}
                <Text
                  style={{
                    color: theme.colors.primary,
                    fontFamily: theme.fonts.bodySemiBold,
                  }}
                >
                  {copy.loginAction}
                </Text>
              </Text>
            </Pressable>
          </Link>
        </View>
      </View>
    </Screen>
  );
}
