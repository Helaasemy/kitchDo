import { useState } from 'react';
import { router } from 'expo-router';
import { Pressable, Text, View } from 'react-native';

import { Button, IconButton, IconTile, PaperCard, Screen, TextField } from '@/components/ui';
import { useTheme } from '@/design';
import { useAuth } from '@/features/auth';
import { useT } from '@/i18n';

export default function ForgotPasswordScreen() {
  const t = useT();
  const theme = useTheme();
  const { requestPasswordReset } = useAuth();
  const copy = t().auth;
  const [email, setEmail] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);

  const goBack = () => {
    if (router.canGoBack()) router.back();
    else router.replace('/(auth)/login');
  };

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

  const onResend = async () => {
    if (resending) return;
    setError(null);
    setResending(true);
    const result = await requestPasswordReset(email);
    setResending(false);
    if (result.error) setError(result.error);
  };

  const [bodyBefore, bodyAfter = ''] = copy.forgotSentBody.split('{email}');

  const errorText = error ? (
    <Text
      style={{
        fontFamily: theme.fonts.body,
        fontSize: theme.typography.caption.fontSize,
        lineHeight: theme.typography.caption.lineHeight,
        color: theme.colors.coral,
      }}
      accessibilityLiveRegion="polite"
      allowFontScaling
    >
      {error}
    </Text>
  ) : null;

  return (
    <Screen scroll>
      <View style={{ gap: theme.space.xl }}>
        <View style={{ alignSelf: 'flex-start' }}>
          <IconButton name="chevron-back" accessibilityLabel={t().common.back} onPress={goBack} />
        </View>

        {sent ? (
          <IconTile
            name="mail-open-outline"
            round
            size={56}
            background={theme.colors.frequency.monthly.tint}
            color={theme.colors.frequency.monthly.text}
          />
        ) : (
          <IconTile name="key-outline" round size={56} />
        )}

        <View style={{ gap: theme.space.sm }}>
          <Text
            style={{
              fontFamily: theme.fonts.display,
              fontSize: theme.typography.display.fontSize,
              lineHeight: theme.typography.display.lineHeight,
              color: theme.colors.ink,
            }}
            accessibilityRole="header"
            allowFontScaling
          >
            {sent ? copy.forgotSentTitle : copy.forgotTitle}
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
            {sent ? (
              <>
                {bodyBefore}
                <Text style={{ fontFamily: theme.fonts.bodySemiBold, color: theme.colors.ink }}>
                  {email.trim()}
                </Text>
                {bodyAfter}
              </>
            ) : (
              copy.forgotSubtitle
            )}
          </Text>
        </View>

        {sent ? (
          <View style={{ gap: theme.space.lg }}>
            <Button
              label={copy.backToLogin}
              variant="secondary"
              onPress={() => router.replace('/(auth)/login')}
            />
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'center',
                gap: theme.space.xs,
              }}
            >
              <Text
                style={{
                  fontFamily: theme.fonts.body,
                  fontSize: theme.typography.bodySmall.fontSize,
                  lineHeight: theme.typography.bodySmall.lineHeight,
                  color: theme.colors.inkMuted,
                }}
                allowFontScaling
              >
                {copy.forgotNoEmail}
              </Text>
              <Pressable
                accessibilityRole="button"
                accessibilityState={{ disabled: resending, busy: resending }}
                disabled={resending}
                onPress={onResend}
                hitSlop={4}
                style={({ pressed }) => ({
                  minHeight: 44,
                  justifyContent: 'center',
                  paddingHorizontal: theme.space.xs,
                  opacity: pressed || resending ? 0.6 : 1,
                })}
              >
                <Text
                  style={{
                    fontFamily: theme.fonts.bodyBold,
                    fontSize: theme.typography.bodySmall.fontSize,
                    lineHeight: theme.typography.bodySmall.lineHeight,
                    color: theme.colors.primary,
                  }}
                  allowFontScaling
                >
                  {copy.forgotResend}
                </Text>
              </Pressable>
            </View>
            {errorText}
          </View>
        ) : (
          <View style={{ gap: theme.space.lg }}>
            <PaperCard style={{ padding: theme.space.lg + theme.space.xs }}>
              <TextField
                label={t().common.email}
                placeholder={copy.emailPlaceholder}
                autoCapitalize="none"
                autoComplete="email"
                autoCorrect={false}
                keyboardType="email-address"
                textContentType="emailAddress"
                returnKeyType="send"
                onSubmitEditing={onSubmit}
                value={email}
                onChangeText={setEmail}
              />
            </PaperCard>
            {errorText}
            <Button label={copy.forgotAction} onPress={onSubmit} loading={loading} />
          </View>
        )}
      </View>
    </Screen>
  );
}
