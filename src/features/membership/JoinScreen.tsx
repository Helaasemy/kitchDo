import { useEffect, useRef, useState } from 'react';
import { router } from 'expo-router';
import { Alert, Modal, Text, View } from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';

import {
  Button,
  ErrorText,
  IconButton,
  PaperCard,
  Screen,
  ScreenHeader,
  TextField,
} from '@/components/ui';
import { useTheme } from '@/design';
import { AuthShell, useAuth } from '@/features/auth';
import { goBackOr } from '@/lib/navigation';
import { useT } from '@/i18n';

import { formatJoinCode, parseJoinPayload } from './joinCode';
import { loadPendingJoin, stashPendingJoinCode } from './pendingJoin';

type Props = {
  initialCode?: string;
};

export function JoinScreen({ initialCode }: Props) {
  const t = useT();
  const theme = useTheme();
  const { status, joinKitchenWithCode, pendingJoinCode, onboarding } = useAuth();
  const onboard = t().onboarding;
  const invite = t().invite;

  const [code, setCode] = useState(initialCode ?? pendingJoinCode ?? '');
  const [displayName, setDisplayName] = useState(onboarding?.displayName ?? '');
  const nameValue = displayName || onboarding?.displayName || '';
  const [scanning, setScanning] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [permission, requestPermission] = useCameraPermissions();
  const seeded = useRef(false);

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
        await stashPendingJoinCode(parsed, pending?.displayName);
      }
      if (pending?.displayName) {
        setDisplayName((current) => current || pending.displayName || '');
      }
    })();
  }, [initialCode, pendingJoinCode]);

  const stashCode = async () => {
    const parsed = parseJoinPayload(code);
    if (parsed) await stashPendingJoinCode(parsed, nameValue);
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

  const continueToAccount = async () => {
    setError(null);
    const parsed = parseJoinPayload(code);
    if (!parsed) {
      setError(onboard.codeRequired);
      return;
    }
    await stashPendingJoinCode(parsed);
    router.replace('/(auth)/signup');
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
      await stashPendingJoinCode(parsed, nameValue);
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

  return (
    <AuthShell mode="join" onBeforeChange={stashCode}>
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
            {onboard.joinTitle}
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
            {onboard.joinSubtitle}
          </Text>
        </View>
        <PaperCard
          style={{
            borderRadius: theme.radii.xxl,
            padding: theme.space.xl,
            gap: theme.space.lg,
          }}
        >
          {codeField}
          <Button
            label={invite.scanQr}
            variant="secondary"
            onPress={() => void openScanner()}
          />
          <ErrorText message={error} boxed />
          <Button
            label={t().common.continue}
            onPress={() => void continueToAccount()}
          />
        </PaperCard>
        {scanner}
    </AuthShell>
  );
}
