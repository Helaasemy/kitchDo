import { useState } from 'react';
import { Link, router } from 'expo-router';
import { Pressable, Text, View } from 'react-native';

import { BrandMark, Button, Screen, TextField } from '@/components/ui';
import { useTheme } from '@/design';
import { useAuth } from '@/features/auth';
import { t } from '@/i18n';

export default function LoginScreen() {
  const theme = useTheme();
  const { signIn, status, configError } = useAuth();
  const copy = t().auth;
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  if (status === 'misconfigured') {
    return (
      <Screen scroll>
        <View style={{ marginTop: theme.space.xxl, gap: theme.space.lg }}>
          <BrandMark size="lg" />
          <Text
            style={{
              fontFamily: theme.fonts.body,
              fontSize: theme.typography.body.fontSize,
              lineHeight: theme.typography.body.lineHeight,
              color: theme.colors.coral,
            }}
            allowFontScaling
          >
            {configError ?? copy.setupMissing}
          </Text>
        </View>
      </Screen>
    );
  }

  const onSubmit = async () => {
    setError(null);
    if (!email.trim()) {
      setError(copy.emailRequired);
      return;
    }
    if (!password) {
      setError(copy.passwordRequired);
      return;
    }
    setLoading(true);
    const result = await signIn(email, password);
    setLoading(false);
    if (result.error) {
      setError(result.error);
      return;
    }
    router.replace('/');
  };

  return (
    <Screen scroll>
      <View
        style={{
          marginTop: theme.space.xxl,
          gap: theme.space.xl,
          width: '100%',
          alignItems: 'stretch',
        }}
      >
        <BrandMark size="lg" />
        <View style={{ gap: theme.space.sm, width: '100%' }}>
          <Text
            style={{
              fontFamily: theme.fonts.display,
              fontSize: theme.typography.title.fontSize,
              lineHeight: theme.typography.title.lineHeight,
              color: theme.colors.ink,
            }}
            allowFontScaling
          >
            {copy.loginTitle}
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
            {copy.loginSubtitle}
          </Text>
        </View>

        <View style={{ gap: theme.space.md, width: '100%' }}>
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
            autoComplete="password"
            textContentType="password"
            value={password}
            onChangeText={setPassword}
          />
          {error ? (
            <Text
              style={{
                fontFamily: theme.fonts.body,
                color: theme.colors.coral,
                fontSize: theme.typography.caption.fontSize,
                lineHeight: theme.typography.caption.lineHeight,
              }}
              allowFontScaling
            >
              {error}
            </Text>
          ) : null}
          <Button label={copy.loginAction} onPress={onSubmit} loading={loading} />
          <Link href="/(auth)/forgot-password" asChild>
            <Pressable
              accessibilityRole="link"
              style={{
                minHeight: 44,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Text
                style={{
                  fontFamily: theme.fonts.bodyMedium,
                  color: theme.colors.primary,
                  fontSize: theme.typography.bodySmall.fontSize,
                  textAlign: 'center',
                }}
                allowFontScaling
              >
                {copy.forgotLink}
              </Text>
            </Pressable>
          </Link>
          <Link href="/(auth)/signup" asChild>
            <Pressable
              accessibilityRole="link"
              style={{
                minHeight: 44,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Text
                style={{
                  fontFamily: theme.fonts.body,
                  color: theme.colors.inkMuted,
                  fontSize: theme.typography.bodySmall.fontSize,
                  textAlign: 'center',
                }}
                allowFontScaling
              >
                {copy.noAccount}{' '}
                <Text
                  style={{
                    color: theme.colors.primary,
                    fontFamily: theme.fonts.bodySemiBold,
                  }}
                >
                  {copy.signupAction}
                </Text>
              </Text>
            </Pressable>
          </Link>
        </View>
      </View>
    </Screen>
  );
}
