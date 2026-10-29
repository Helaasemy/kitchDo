import { useState } from 'react';
import { Link } from 'expo-router';
import { Pressable, Text, View } from 'react-native';

import { BrandMark, Button, Screen, TextField } from '@/components/ui';
import { useTheme } from '@/design';
import { useAuth } from '@/features/auth';
import { t } from '@/i18n';

export default function ForgotPasswordScreen() {
  const theme = useTheme();
  const { requestPasswordReset } = useAuth();
  const copy = t().auth;
  const [email, setEmail] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);

  const onSubmit = async () => {
    setError(null);
    if (!email.trim()) {
      setError(copy.emailRequired);
      return;
    }
    setLoading(true);
    const result = await requestPasswordReset(email);
    setLoading(false);
    if (result.error) {
      setError(result.error);
      return;
    }
    setSent(true);
  };

  return (
    <Screen scroll>
      <View style={{ marginTop: theme.space.xxl, gap: theme.space.xl }}>
        <BrandMark size="md" />
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
            {copy.forgotTitle}
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
            {sent ? copy.forgotSent : copy.forgotSubtitle}
          </Text>
        </View>

        {!sent ? (
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
            <Button label={copy.forgotAction} onPress={onSubmit} loading={loading} />
          </View>
        ) : null}

        <Link href="/(auth)/login" asChild>
          <Pressable accessibilityRole="link">
            <Text
              style={{
                fontFamily: theme.fonts.bodyMedium,
                color: theme.colors.primary,
                fontSize: theme.typography.bodySmall.fontSize,
              }}
              allowFontScaling
            >
              {t().common.back}
            </Text>
          </Pressable>
        </Link>
      </View>
    </Screen>
  );
}
