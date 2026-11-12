import { type ComponentRef, useEffect, useRef, useState } from 'react';
import { Link, router } from 'expo-router';
import { ActivityIndicator, Alert, Modal, Pressable, Text, TextInput, View } from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';

import {
  Button,
  ErrorText,
  IconButton,
  PaperCard,
  PasswordField,
  RequirementRow,
  Screen,
  ScreenHeader,
  TextField,
} from '@/components/ui';
import { useTheme } from '@/design';
import { AuthShell, ConfirmEmail, useAuth } from '@/features/auth';
import { goBackOr } from '@/lib/navigation';
import { useT } from '@/i18n';

import { formatJoinCode, parseJoinPayload } from './joinCode';
import { loadPendingJoin } from './pendingJoin';

type Props = {
  initialCode?: string;
};

export function JoinScreen({ initialCode }: Props) {
  const t = useT();
  const theme = useTheme();
  const {
    status,
    joinKitchenWithCode,
    pendingJoinCode,
    onboarding,
    rememberPendingJoin,
    signIn,
    signUp,
    resendSignupEmail,
    verifyEmailOtp,
    completingJoin,
  } = useAuth();
  const onboard = t().onboarding;
  const invite = t().invite;
  const copy = t().auth;

  const [code, setCode] = useState(initialCode ?? pendingJoinCode ?? '');
  const [displayName, setDisplayName] = useState(onboarding?.displayName ?? '');
  const nameValue = displayName || onboarding?.displayName || '';
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [accountMode, setAccountMode] = useState<'signup' | 'signin'>('signup');
  const [existingAccount, setExistingAccount] = useState(false);
  const [checkEmail, setCheckEmail] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [permission, requestPermission] = useCameraPermissions();
  const seeded = useRef(false);
  const emailRef = useRef<ComponentRef<typeof TextInput>>(null);
  const passwordRef = useRef<ComponentRef<typeof TextInput>>(null);

  const signedIn = status === 'authenticated' || status === 'needs_onboarding';
  const needsName = status === 'needs_onboarding' || !onboarding?.displayName;

  useEffect(() => {
    if (seeded.current) return;
    seeded.current = true;
    void (async () => {
      const pending = await loadPendingJoin();
      const raw = initialCode || pendingJoinCode || pending?.code;
      const parsed = parseJoinPayload(raw);
      if (parsed) {
        setCode(formatJoinCode(parsed));
        await rememberPendingJoin(parsed, pending?.displayName);
      }
      if (pending?.displayName) {
        setDisplayName((current) => current || pending.displayName || '');
      }
    })();
  }, [initialCode, pendingJoinCode, rememberPendingJoin]);

  const stashCode = async () => {
    const parsed = parseJoinPayload(code);
    if (parsed) await rememberPendingJoin(parsed, nameValue);
  };

  const backTo = () => {
    if (status === 'needs_onboarding') {
      goBackOr('/(onboarding)');
      return;
    }
    if (status === 'authenticated') {
      goBackOr();
      return;
    }
    goBackOr('/(auth)/login');
  };

  const finishJoined = (alreadyMember?: boolean) => {
    const goHome = () => router.replace('/(app)/(tabs)/today');
    if (alreadyMember) {
      Alert.alert(invite.alreadyMember, undefined, [
        { text: t().common.done, onPress: goHome },
      ]);
      return;
    }
    goHome();
  };

  const parsedCodeOrError = (): string | null => {
    const parsed = parseJoinPayload(code);
    if (!parsed) {
      setError(onboard.codeRequired);
      return null;
    }
    return parsed;
  };

  const submitSignedIn = async (raw: string) => {
    setError(null);
    const parsed = parseJoinPayload(raw);
    if (!parsed) {
      setError(invite.invalidCode);
      return;
    }
    if (needsName && !nameValue.trim()) {
      setError(onboard.displayNameRequired);
      return;
    }
    setLoading(true);
    try {
      await rememberPendingJoin(parsed, nameValue);
      const result = await joinKitchenWithCode(parsed, nameValue.trim());
      if (result.error) {
        setError(result.error);
        return;
      }
      finishJoined(result.alreadyMember);
    } finally {
      setLoading(false);
    }
  };

  const submitJoinAccount = async () => {
    setError(null);
    const parsed = parsedCodeOrError();
    if (!parsed) return;
    if (accountMode === 'signup' && !nameValue.trim()) {
      setError(onboard.displayNameRequired);
      return;
    }
    if (!email.trim()) {
      setError(copy.emailRequired);
      return;
    }
    if (accountMode === 'signup' && password.length < 8) {
      setError(copy.passwordTooShort);
      return;
    }
    if (accountMode === 'signin' && !password) {
      setError(copy.passwordRequired);
      return;
    }
    setLoading(true);
    try {
      await rememberPendingJoin(parsed, nameValue);
      if (accountMode === 'signup') {
        const created = await signUp(email, password);
        if (created.alreadyRegistered) {
          setAccountMode('signin');
          setExistingAccount(true);
          setPassword('');
          setError(null);
          return;
        }
        if (created.error) {
          setError(created.error);
          return;
        }
        if (created.needsConfirmation) {
          setCheckEmail(true);
          return;
        }
      } else {
        const session = await signIn(email, password);
        if (session.error) {
          setError(session.error);
          return;
        }
        return;
      }
      const result = await joinKitchenWithCode(parsed, nameValue.trim() || undefined);
      if (result.error) {
        setError(result.error);
        return;
      }
      finishJoined(result.alreadyMember);
    } finally {
      setLoading(false);
    }
  };

  const openScanner = async () => {
    const granted = permission?.granted || (await requestPermission()).granted;
    if (!granted) {
      Alert.alert(invite.cameraDenied);
      return;
    }
    setScanning(true);
  };

  if (status === 'loading' || status === 'misconfigured') {
    return (
      <Screen>
        <View style={{ flex: 1 }} />
      </Screen>
    );
  }

  const codeField = (
    <TextField
      label={onboard.codeLabel}
      value={code}
      onChangeText={setCode}
      autoCapitalize="characters"
      placeholder={onboard.codePlaceholder}
    />
  );

  const scanner = (
    <Modal visible={scanning} animationType="slide">
      <View style={{ flex: 1, backgroundColor: '#000' }}>
        <CameraView
          style={{ flex: 1 }}
          barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
          onBarcodeScanned={({ data }) => {
            setScanning(false);
            const parsed = parseJoinPayload(data);
            if (parsed) setCode(formatJoinCode(parsed));
            if (signedIn) {
              void submitSignedIn(data);
            }
          }}
        />
        <View
          style={{
            position: 'absolute',
            bottom: 40,
            left: 24,
            right: 24,
          }}
        >
          <Button
            label={invite.closeScanner}
            variant="secondary"
            onPress={() => setScanning(false)}
          />
        </View>
      </View>
    </Modal>
  );

  if (completingJoin) {
    return (
      <Screen>
        <View
          style={{
            flex: 1,
            alignItems: 'center',
            justifyContent: 'center',
            gap: theme.space.md,
          }}
        >
          <ActivityIndicator color={theme.colors.primary} />
          <Text
            style={{
              fontFamily: theme.fonts.body,
              fontSize: theme.typography.body.fontSize,
              color: theme.colors.inkMuted,
            }}
            accessibilityLiveRegion="polite"
            allowFontScaling
          >
            {copy.confirmingEmail}
          </Text>
        </View>
      </Screen>
    );
  }

  if (signedIn) {
    return (
      <Screen scroll>
        <View style={{ gap: theme.space.xl }}>
          <IconButton
            name="chevron-back"
            accessibilityLabel={t().common.back}
            onPress={backTo}
          />
          <ScreenHeader title={onboard.joinTitle} />
          <Text
            style={{
              fontFamily: theme.fonts.body,
              color: theme.colors.inkMuted,
            }}
            allowFontScaling
          >
            {onboard.joinSubtitle}
          </Text>
          {needsName ? (
            <TextField
              label={t().common.displayName}
              value={nameValue}
              onChangeText={setDisplayName}
              autoComplete="name"
              textContentType="name"
            />
          ) : null}
          {codeField}
          <Button
            label={invite.scanQr}
            variant="secondary"
            onPress={() => void openScanner()}
          />
          <ErrorText message={error} boxed />
          <Button
            label={invite.joinAction}
            loading={loading}
            onPress={() => void submitSignedIn(code)}
          />
          {status === 'needs_onboarding' ? (
            <Button
              label={onboard.createOwnKitchen}
              variant="ghost"
              onPress={() => router.replace('/(onboarding)')}
            />
          ) : null}
        </View>
        {scanner}
      </Screen>
    );
  }

  if (checkEmail) {
    return (
      <Screen scroll>
        <ConfirmEmail
          email={email}
          body={copy.signupCheckJoinBody}
          onVerify={(value, token) => verifyEmailOtp(value, token, 'signup')}
          onResend={resendSignupEmail}
          onBack={() => goBackOr('/(auth)/login')}
        />
      </Screen>
    );
  }

  return (
    <AuthShell mode="join" onBeforeChange={stashCode}>
      <View style={{ gap: theme.space.sm, marginBottom: theme.space.xl }}>
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
          {accountMode === 'signup' ? onboard.accountTitle : onboard.signInToJoin}
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
          {accountMode === 'signup'
            ? onboard.accountSubtitle
            : existingAccount
              ? copy.alreadyRegisteredJoin
              : onboard.signInToJoinSubtitle}
        </Text>
      </View>
      <PaperCard
        style={{
          borderRadius: theme.radii.xxl,
          padding: theme.space.xl,
          gap: theme.space.lg,
          marginBottom: theme.space.lg,
        }}
      >
        {codeField}
        <Button
          label={invite.scanQr}
          variant="secondary"
          onPress={() => void openScanner()}
        />
        {accountMode === 'signup' ? (
          <TextField
            label={t().common.displayName}
            value={nameValue}
            onChangeText={setDisplayName}
            autoComplete="name"
            textContentType="name"
            returnKeyType="next"
            onSubmitEditing={() => emailRef.current?.focus()}
          />
        ) : null}
        <TextField
          ref={emailRef}
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
            autoComplete={accountMode === 'signup' ? 'new-password' : 'password'}
            textContentType={accountMode === 'signup' ? 'newPassword' : 'password'}
            returnKeyType="go"
            onSubmitEditing={() => void submitJoinAccount()}
            value={password}
            onChangeText={setPassword}
          />
          {accountMode === 'signup' ? (
            <View style={{ paddingLeft: theme.space.xs }}>
              <RequirementRow label={copy.ruleLength} met={password.length >= 8} />
            </View>
          ) : (
            <Link href="/(auth)/forgot-password" asChild>
              <Pressable
                accessibilityRole="link"
                onPress={() => void stashCode()}
                style={{
                  minHeight: 44,
                  alignSelf: 'flex-start',
                  justifyContent: 'center',
                }}
              >
                <Text
                  style={{
                    fontFamily: theme.fonts.bodySemiBold,
                    fontSize: theme.typography.bodySmall.fontSize,
                    lineHeight: theme.typography.bodySmall.lineHeight,
                    color: theme.colors.primary,
                  }}
                  allowFontScaling
                >
                  {copy.forgotLink}
                </Text>
              </Pressable>
            </Link>
          )}
        </View>
        <ErrorText message={error} boxed />
        <Button
          label={accountMode === 'signup' ? invite.joinAction : onboard.signInToJoin}
          loading={loading}
          onPress={() => void submitJoinAccount()}
        />
      </PaperCard>
      <Button
        label={accountMode === 'signup' ? onboard.signInToJoin : onboard.accountTitle}
        variant="ghost"
        onPress={() => {
          setError(null);
          setExistingAccount(false);
          setPassword('');
          setAccountMode((mode) => (mode === 'signup' ? 'signin' : 'signup'));
        }}
      />
      {scanner}
    </AuthShell>
  );
}
