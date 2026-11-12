import { useState } from 'react';
import { Text, View } from 'react-native';

import { Button, ErrorText, IconTile, PaperCard, TextField } from '@/components/ui';
import { useTheme } from '@/design';
import { AUTH_OTP_LENGTH, normalizeAuthOtp } from '@/features/auth/authErrors';
import { useT } from '@/i18n';

export function ConfirmEmail({
  email,
  body,
  onVerify,
  onResend,
  onBack,
}: {
  email: string;
  body: string;
  onVerify: (email: string, token: string) => Promise<{ error: string | null }>;
  onResend: (email: string) => Promise<{ error: string | null }>;
  onBack: () => void;
}) {
  const t = useT();
  const theme = useTheme();
  const copy = t().auth;
  const [code, setCode] = useState('');
  const [verifying, setVerifying] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resent, setResent] = useState(false);

  const confirm = async () => {
    const token = normalizeAuthOtp(code);
    if (!token) {
      setError(copy.signupCodeInvalid);
      return;
    }
    setError(null);
    setResent(false);
    setVerifying(true);
    const result = await onVerify(email, token);
    setVerifying(false);
    if (result.error) setError(result.error);
  };

  const resend = async () => {
    setError(null);
    setResent(false);
    setSending(true);
    const result = await onResend(email);
    setSending(false);
    if (result.error) {
      setError(result.error);
      return;
    }
    setResent(true);
  };

  return (
    <View style={{ gap: theme.space.xl, paddingTop: theme.space.xxl }}>
      <IconTile
        name="mail-open-outline"
        size={56}
        round
        background={theme.colors.frequency.monthly.tint}
        color={theme.colors.frequency.monthly.text}
      />
      <View style={{ gap: theme.space.sm }}>
        <Text
          accessibilityRole="header"
          style={{
            fontFamily: theme.fonts.display,
            fontSize: theme.typography.display.fontSize,
            lineHeight: theme.typography.display.lineHeight,
            color: theme.colors.ink,
          }}
          allowFontScaling
        >
          {copy.signupCheckTitle}
        </Text>
        <Text
          style={{
            fontFamily: theme.fonts.body,
            fontSize: theme.typography.body.fontSize,
            color: theme.colors.inkMuted,
          }}
          allowFontScaling
        >
          {body.replace('{email}', email.trim())}
        </Text>
      </View>
      <PaperCard
        style={{
          borderRadius: theme.radii.xxl,
          padding: theme.space.xl,
        }}
      >
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
          onSubmitEditing={() => void confirm()}
        />
      </PaperCard>
      {resent ? (
        <Text
          style={{
            fontFamily: theme.fonts.bodyMedium,
            fontSize: theme.typography.bodySmall.fontSize,
            color: theme.colors.frequency.monthly.text,
          }}
          accessibilityLiveRegion="polite"
          allowFontScaling
        >
          {copy.signupResent.replace('{email}', email.trim())}
        </Text>
      ) : null}
      <ErrorText message={error} boxed />
      <Button
        label={copy.signupCodeAction}
        loading={verifying}
        onPress={() => void confirm()}
      />
      <Button
        label={copy.forgotResend}
        variant="secondary"
        loading={sending}
        onPress={() => void resend()}
      />
      <Button label={copy.backToLogin} variant="ghost" onPress={onBack} />
    </View>
  );
}
