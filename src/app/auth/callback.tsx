import { useState } from 'react';
import { Redirect, router } from 'expo-router';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';

import {
  Button,
  ErrorText,
  IconTile,
  PaperCard,
  PasswordField,
  RequirementRow,
  Screen,
} from '@/components/ui';
import { useTheme } from '@/design';
import { useAuth } from '@/features/auth';
import { useT } from '@/i18n';

export default function AuthCallbackScreen() {
  const t = useT();
  const theme = useTheme();
  const { updatePassword, status, recoveryPending, authLinkError } = useAuth();
  const copy = t().auth;
  const [error, setError] = useState<string | null>(null);
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  const onSubmit = async () => {
    setError(null);
    if (password.length < 8) {
      setError(copy.passwordTooShort);
      return;
    }
    if (confirm !== password) {
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

  const displayError = error ?? authLinkError;

  if (status === 'loading') {
    return (
      <Screen>
        <View
          style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}
          accessible
          accessibilityLabel={t().common.loading}
        >
          <ActivityIndicator color={theme.colors.primary} />
        </View>
      </Screen>
    );
  }

  if (!recoveryPending && status === 'authenticated' && !done) {
    return <Redirect href="/" />;
  }

  const monthly = theme.colors.frequency.monthly;
  const needsDevice = status === 'unauthenticated' && !displayError && !recoveryPending;

  return (
    <Screen scroll>
      <View style={{ flex: 1, paddingTop: 80, gap: theme.space.xl }}>
        <View style={{ alignItems: 'center', gap: theme.space.lg }}>
          <IconTile name="lock-closed" size={64} />
          <View style={{ alignItems: 'center', gap: theme.space.sm }}>
            <Text
              style={{
                fontFamily: theme.fonts.display,
                fontSize: theme.typography.display.fontSize,
                lineHeight: theme.typography.display.lineHeight,
                color: theme.colors.ink,
                textAlign: 'center',
              }}
              accessibilityRole="header"
              allowFontScaling
            >
              {copy.resetTitle}
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
              {needsDevice ? copy.resetOpenOnDevice : copy.resetSubtitle}
            </Text>
          </View>
        </View>

        {done ? (
          <View
            style={{
              backgroundColor: monthly.tint,
              borderRadius: theme.radii.xl + theme.space.xs,
              padding: 20,
              borderWidth: 0.5,
              borderColor: `${monthly.base}33`,
              flexDirection: 'row',
              alignItems: 'center',
              gap: theme.space.md,
            }}
          >
            <View
              style={{
                width: 40,
                height: 40,
                borderRadius: 20,
                backgroundColor: monthly.base,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Ionicons name="checkmark" size={22} color="#FFFFFF" />
            </View>
            <View style={{ flex: 1 }}>
              <Text
                style={{
                  fontFamily: theme.fonts.bodyBold,
                  fontSize: 15,
                  lineHeight: 20,
                  color: monthly.text,
                }}
                accessibilityLiveRegion="polite"
                allowFontScaling
              >
                {copy.resetSuccess}
              </Text>
              <Pressable
                accessibilityRole="link"
                onPress={() => router.replace('/')}
                hitSlop={4}
                style={({ pressed }) => ({
                  minHeight: 44,
                  flexDirection: 'row',
                  alignItems: 'center',
                  alignSelf: 'flex-start',
                  gap: theme.space.xs,
                  opacity: pressed ? 0.7 : 1,
                })}
              >
                <Text
                  style={{
                    fontFamily: theme.fonts.bodyExtraBold,
                    fontSize: theme.typography.caption.fontSize,
                    lineHeight: theme.typography.caption.lineHeight,
                    color: monthly.text,
                    textTransform: 'uppercase',
                    letterSpacing: 1,
                  }}
                  allowFontScaling
                >
                  {copy.resetGoToday}
                </Text>
                <Ionicons name="arrow-forward" size={16} color={monthly.text} />
              </Pressable>
            </View>
          </View>
        ) : needsDevice ? null : (
          <View style={{ gap: theme.space.lg }}>
            <PaperCard style={{ borderRadius: theme.radii.xxl, padding: theme.space.xl, gap: theme.space.xl }}>
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
                onSubmitEditing={onSubmit}
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
            <ErrorText message={displayError} boxed />
            <Button
              label={copy.resetAction}
              onPress={onSubmit}
              loading={loading}
              disabled={status === 'unauthenticated'}
            />
          </View>
        )}

        {!done ? (
          <Pressable
            accessibilityRole="link"
            onPress={() => router.replace('/(auth)/login')}
            hitSlop={4}
            style={({ pressed }) => ({
              minHeight: 44,
              alignSelf: 'center',
              justifyContent: 'center',
              paddingHorizontal: theme.space.md,
              marginTop: 'auto',
              opacity: pressed ? 0.7 : 1,
            })}
          >
            <Text
              style={{
                fontFamily: theme.fonts.bodyExtraBold,
                fontSize: theme.typography.caption.fontSize,
                lineHeight: theme.typography.caption.lineHeight,
                color: theme.colors.inkMuted,
                textTransform: 'uppercase',
                letterSpacing: 1,
              }}
              allowFontScaling
            >
              {copy.backToLogin}
            </Text>
          </Pressable>
        ) : null}
      </View>
    </Screen>
  );
}
