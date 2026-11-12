import { type ComponentProps, type ComponentRef, useRef, useState } from 'react';
import { Text, TextInput, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';

import {
  Button,
  ErrorText,
  IconTile,
  PaperCard,
  PasswordField,
  RequirementRow,
  Screen,
  TextField,
} from '@/components/ui';
import { useTheme } from '@/design';
import { AuthShell, useAuth } from '@/features/auth';
import type { TaskFrequency } from '@/features/recurring/period';
import { goBackOr } from '@/lib/navigation';
import { useT } from '@/i18n';

type Benefit = {
  frequency: TaskFrequency;
  icon: ComponentProps<typeof Ionicons>['name'];
  label: string;
};

export default function SignupScreen() {
  const t = useT();
  const theme = useTheme();
  const { signUp } = useAuth();
  const copy = t().auth;
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const passwordRef = useRef<ComponentRef<typeof TextInput>>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [checkEmail, setCheckEmail] = useState(false);

  const benefits: Benefit[] = [
    {
      frequency: 'daily',
      icon: 'calendar-outline',
      label: copy.benefitFrequencies,
    },
    {
      frequency: 'weekly',
      icon: 'layers-outline',
      label: copy.benefitTemplates,
    },
    {
      frequency: 'monthly',
      icon: 'people-outline',
      label: copy.benefitInvite,
    },
  ];

  const goBack = () => goBackOr('/(auth)/login');

  const onSubmit = async () => {
    if (loading) return;
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
    if (result.needsConfirmation) {
      setCheckEmail(true);
    }
  };

  if (checkEmail) {
    return (
      <Screen scroll>
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
                {copy.signupCheckBody.replace('{email}', email.trim())}
              </Text>
            </View>
            <Button
              label={copy.backToLogin}
              variant="secondary"
              onPress={goBack}
            />
          </View>
      </Screen>
    );
  }

  return (
    <AuthShell mode="signup">
        <View style={{ gap: theme.space.sm, marginBottom: theme.space.xl }}>
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

        <PaperCard
          style={{
            borderRadius: theme.radii.xxl,
            padding: theme.space.xl,
            gap: theme.space.xl,
            marginBottom: theme.space.xl,
          }}
        >
          <TextField
            label={t().common.email}
            placeholder={copy.emailPlaceholder}
            autoCapitalize="none"
            autoCorrect={false}
            autoComplete="email"
            keyboardType="email-address"
            textContentType="emailAddress"
            returnKeyType="next"
            submitBehavior="submit"
            onSubmitEditing={() => passwordRef.current?.focus()}
            value={email}
            onChangeText={setEmail}
          />
          <View style={{ gap: theme.space.md }}>
            <PasswordField
              ref={passwordRef}
              label={t().common.password}
              autoComplete="new-password"
              textContentType="newPassword"
              returnKeyType="go"
              onSubmitEditing={() => void onSubmit()}
              value={password}
              onChangeText={setPassword}
            />
            <View style={{ paddingLeft: theme.space.xs }}>
              <RequirementRow
                label={copy.ruleLength}
                met={password.length >= 8}
              />
            </View>
          </View>
          <ErrorText message={error} boxed />
        </PaperCard>

        <View style={{ gap: theme.space.lg, marginBottom: theme.space.xl }}>
          {benefits.map((benefit) => {
            const tone = theme.colors.frequency[benefit.frequency];
            return (
              <View
                key={benefit.frequency}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: theme.space.md,
                }}
              >
                <View
                  style={{
                    width: 32,
                    height: 32,
                    borderRadius: theme.radii.sm,
                    backgroundColor: tone.tint,
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Ionicons name={benefit.icon} size={16} color={tone.text} />
                </View>
                <Text
                  style={{
                    flex: 1,
                    fontFamily: theme.fonts.bodyMedium,
                    fontSize: theme.typography.bodySmall.fontSize,
                    lineHeight: theme.typography.bodySmall.lineHeight,
                    color: theme.colors.ink,
                  }}
                  allowFontScaling
                >
                  {benefit.label}
                </Text>
              </View>
            );
          })}
        </View>

        <Button
          label={copy.signupAction}
          onPress={onSubmit}
          loading={loading}
        />
    </AuthShell>
  );
}
