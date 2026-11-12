import { useState } from 'react';
import { router } from 'expo-router';
import { Pressable, Text, View } from 'react-native';

import {
  Button,
  ErrorText,
  IconButton,
  IconTile,
  PaperCard,
  PasswordField,
  RequirementRow,
  Screen,
  TextField,
} from '@/components/ui';
import { useTheme } from '@/design';
import { AUTH_OTP_LENGTH, normalizeAuthOtp, useAuth } from '@/features/auth';
import { useT } from '@/i18n';

export default function ForgotPasswordScreen() {
  const t = useT();
  const theme = useTheme();
  const { requestPasswordReset, verifyEmailOtp, updatePassword, recoveryPending } =
    useAuth();
  const copy = t().auth;
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  const [done, setDone] = useState(false);
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);

  const goBack = () => {
    if (router.canGoBack()) router.back();
    else router.replace('/(auth)/login');
  };

  const onSubmitEmail = async () => {
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

  const onSubmitCode = async () => {
    const token = normalizeAuthOtp(code);
    if (!token) {
      setError(copy.signupCodeInvalid);
      return;
    }
    setError(null);
    setLoading(true);
    const result = await verifyEmailOtp(email, token, 'recovery');
    setLoading(false);
    if (result.error) setError(result.error);
  };

  const onSubmitPassword = async () => {
    setError(null);
    if (password.length < 8) {
      setError(copy.passwordTooShort);
      return;
    }
    if (password !== confirm) {
      setError(copy.passwordsDontMatch);
      return;
    }
    setLoading(true);
    const result = await updatePassword(password);
    setLoading(false);
    if (result.error) {
      setError(result.error);
      return;
    }
    setDone(true);
  };

  const [bodyBefore, bodyAfter = ''] = copy.forgotSentBody.split('{email}');
  const choosingPassword = sent && recoveryPending && !done;
  const enteringCode = sent && !recoveryPending && !done;

  return (
    <Screen scroll>
      <View style={{ gap: theme.space.xl }}>
        <View style={{ alignSelf: 'flex-start' }}>
          <IconButton name="chevron-back" accessibilityLabel={t().common.back} onPress={goBack} />
        </View>

        {sent ? (
          <IconTile
            name={choosingPassword || done ? 'key-outline' : 'mail-open-outline'}
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
            {done
              ? copy.resetSuccess
              : choosingPassword
                ? copy.resetTitle
                : sent
                  ? copy.forgotSentTitle
                  : copy.forgotTitle}
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
            {enteringCode ? (
              <>
                {bodyBefore}
                <Text style={{ fontFamily: theme.fonts.bodySemiBold, color: theme.colors.ink }}>
                  {email.trim()}
                </Text>
                {bodyAfter}
              </>
            ) : choosingPassword ? (
              copy.resetSubtitle
            ) : done ? (
              copy.resetGoToday
            ) : (
              copy.forgotSubtitle
            )}
          </Text>
        </View>

        {done ? (
          <Button label={copy.resetGoToday} onPress={() => router.replace('/')} />
        ) : choosingPassword ? (
          <View style={{ gap: theme.space.lg }}>
            <PaperCard
              style={{
                borderRadius: theme.radii.xxl,
                padding: theme.space.xl,
                gap: theme.space.xl,
              }}
            >
              <PasswordField
                label={copy.newPassword}
                autoComplete="new-password"
                textContentType="newPassword"
                value={password}
                onChangeText={setPassword}
              />
              <PasswordField
                label={copy.confirmPassword}
                autoComplete="new-password"
                textContentType="newPassword"
                returnKeyType="done"
                onSubmitEditing={() => void onSubmitPassword()}
                value={confirm}
                onChangeText={setConfirm}
              />
              <View style={{ gap: theme.space.sm }}>
                <RequirementRow label={copy.ruleLength} met={password.length >= 8} />
                <RequirementRow
                  label={copy.ruleMatch}
                  met={confirm.length > 0 && confirm === password}
                />
              </View>
            </PaperCard>
            <ErrorText message={error} boxed />
            <Button
              label={copy.resetAction}
              onPress={() => void onSubmitPassword()}
              loading={loading}
            />
          </View>
        ) : enteringCode ? (
          <View style={{ gap: theme.space.lg }}>
            <PaperCard style={{ padding: theme.space.lg + theme.space.xs }}>
              <TextField
                label={copy.signupCodeLabel}
                value={code}
                onChangeText={(value) =>
                  setCode(value.replace(/[^\d]/g, '').slice(0, AUTH_OTP_LENGTH))
                }
                keyboardType="number-pad"
                inputMode="numeric"
                textContentType="oneTimeCode"
                autoComplete="one-time-code"
                autoFocus
                maxLength={AUTH_OTP_LENGTH}
                returnKeyType="done"
                onSubmitEditing={() => void onSubmitCode()}
              />
            </PaperCard>
            <ErrorText message={error} boxed />
            <Button
              label={copy.signupCodeAction}
              onPress={() => void onSubmitCode()}
              loading={loading}
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
                onPress={() => void onResend()}
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
                onSubmitEditing={() => void onSubmitEmail()}
                value={email}
                onChangeText={setEmail}
              />
            </PaperCard>
            <ErrorText message={error} boxed />
            <Button
              label={copy.forgotAction}
              onPress={() => void onSubmitEmail()}
              loading={loading}
            />
          </View>
        )}
      </View>
    </Screen>
  );
}
