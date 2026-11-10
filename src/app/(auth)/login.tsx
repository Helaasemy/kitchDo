import { useRef, useState, type ComponentRef } from 'react';
import { Link } from 'expo-router';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  Text,
  TextInput,
  View,
} from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';

import {
  Button,
  PaperCard,
  PasswordField,
  Screen,
  TextField,
  Wordmark,
} from '@/components/ui';
import { useTheme } from '@/design';
import { useAuth } from '@/features/auth';
import { useT } from '@/i18n';

export default function LoginScreen() {
  const t = useT();
  const theme = useTheme();
  const { signIn, status, configError } = useAuth();
  const copy = t().auth;
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const passwordRef = useRef<ComponentRef<typeof TextInput>>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const contentStyle = {
    paddingHorizontal: theme.space.xxl,
    paddingTop: theme.space.xxxl + theme.space.xxl,
  };

  if (status === 'misconfigured') {
    return (
      <Screen scroll contentStyle={contentStyle}>
        <View style={{ alignItems: 'center', gap: theme.space.xl }}>
          <Wordmark size="lg" />
          <Text
            style={{
              fontFamily: theme.fonts.bodyMedium,
              fontSize: theme.typography.body.fontSize,
              lineHeight: theme.typography.body.lineHeight,
              color: theme.colors.coral,
              textAlign: 'center',
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
    if (loading) return;
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
    if (result.error) setError(result.error);
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: theme.colors.canvas }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <Screen scroll contentStyle={contentStyle}>
        <View style={{ alignItems: 'center', marginBottom: theme.space.xxxl }}>
          <Wordmark size="lg" />
        </View>

        <View style={{ gap: theme.space.sm, marginBottom: theme.space.xxl }}>
          <Text
            accessibilityRole="header"
            style={{
              fontFamily: theme.fonts.display,
              fontSize: theme.typography.display.fontSize,
              lineHeight: theme.typography.display.lineHeight,
              color: theme.colors.ink,
              textAlign: 'center',
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
              textAlign: 'center',
            }}
            allowFontScaling
          >
            {copy.loginSubtitle}
          </Text>
        </View>

        <PaperCard
          style={{
            borderRadius: theme.radii.xxl,
            padding: theme.space.xl,
            gap: theme.space.lg + theme.space.xs,
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
          <PasswordField
            ref={passwordRef}
            label={t().common.password}
            autoComplete="password"
            textContentType="password"
            returnKeyType="go"
            onSubmitEditing={() => void onSubmit()}
            value={password}
            onChangeText={setPassword}
          />
          {error ? (
            <View
              accessibilityLiveRegion="polite"
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: theme.space.sm,
                padding: theme.space.md,
                borderRadius: theme.radii.sm,
                backgroundColor: theme.colors.alertTint,
              }}
            >
              <Ionicons
                name="alert-circle"
                size={18}
                color={theme.colors.coral}
              />
              <Text
                style={{
                  flex: 1,
                  fontFamily: theme.fonts.bodySemiBold,
                  fontSize: theme.typography.caption.fontSize,
                  lineHeight: theme.typography.caption.lineHeight,
                  color: theme.colors.coral,
                }}
                allowFontScaling
              >
                {error}
              </Text>
            </View>
          ) : null}
          <Button
            label={copy.loginAction}
            onPress={onSubmit}
            loading={loading || status === 'loading'}
          />
        </PaperCard>

        <View style={{ flexGrow: 1, minHeight: theme.space.xxl }} />

        <View style={{ gap: theme.space.xxl, alignItems: 'center' }}>
          <Link href="/(auth)/forgot-password" asChild>
            <Pressable
              accessibilityRole="link"
              style={{
                minHeight: 44,
                paddingHorizontal: theme.space.md,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Text
                style={{
                  fontFamily: theme.fonts.bodySemiBold,
                  fontSize: theme.typography.bodySmall.fontSize,
                  lineHeight: theme.typography.bodySmall.lineHeight,
                  color: theme.colors.primary,
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
                paddingHorizontal: theme.space.md,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Text
                style={{
                  fontFamily: theme.fonts.body,
                  fontSize: 15,
                  lineHeight: 22,
                  color: theme.colors.inkMuted,
                  textAlign: 'center',
                }}
                allowFontScaling
              >
                {copy.noAccount}{' '}
                <Text
                  style={{
                    fontFamily: theme.fonts.bodyBold,
                    color: theme.colors.primary,
                  }}
                >
                  {copy.signupAction}
                </Text>
              </Text>
            </Pressable>
          </Link>
        </View>
      </Screen>
    </KeyboardAvoidingView>
  );
}
