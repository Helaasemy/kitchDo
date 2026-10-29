import { useCallback, useEffect, useState } from 'react';
import {
  Alert,
  Modal,
  Pressable,
  Switch,
  Text,
  View,
} from 'react-native';
import Constants from 'expo-constants';
import { router } from 'expo-router';

import { Button, ListRow, Screen, SyncBanner, TextField } from '@/components/ui';
import { useTheme } from '@/design';
import { useAuth } from '@/features/auth';
import {
  updateKitchen,
  updateProfileDisplayName,
} from '@/features/kitchens/api';
import {
  deleteMyAccount,
  getRemindersEnabled,
  setRemindersEnabled,
} from '@/features/settings/api';
import { clearAccountLocalData } from '@/lib/storage';
import { goBackOr } from '@/lib/navigation';
import { cancelAllMappedReminders } from '@/lib/notifications';
import { useSync } from '@/lib/sync';
import { t, type KitchenMode } from '@/i18n';

export default function SettingsScreen() {
  const theme = useTheme();
  const {
    signOut,
    onboarding,
    user,
    kitchenMode,
    kitchenId,
    refreshOnboarding,
    setOnboardingDraft,
  } = useAuth();
  const { retry } = useSync();
  const copy = t().settings;
  const version =
    Constants.expoConfig?.version ?? Constants.nativeAppVersion ?? '1.0.0';

  const [reminders, setReminders] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [kitchenOpen, setKitchenOpen] = useState(false);
  const [displayName, setDisplayName] = useState(onboarding?.displayName ?? '');
  const [kitchenName, setKitchenName] = useState(onboarding?.kitchenName ?? '');
  const [kind, setKind] = useState<KitchenMode>(kitchenMode);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!user?.id) return;
    void getRemindersEnabled(user.id).then(setReminders);
  }, [user?.id]);

  useEffect(() => {
    setDisplayName(onboarding?.displayName ?? '');
    setKitchenName(onboarding?.kitchenName ?? '');
    setKind(onboarding?.mode ?? 'home');
  }, [onboarding]);

  const onToggleReminders = useCallback(
    async (next: boolean) => {
      if (!user?.id || !kitchenId) return;
      const result = await setRemindersEnabled({
        userId: user.id,
        kitchenId,
        enabled: next,
      });
      setReminders(result.enabled);
      if (result.permissionDenied) {
        Alert.alert(copy.reminders, copy.remindersPermissionDenied);
      }
    },
    [user?.id, kitchenId, copy.reminders, copy.remindersPermissionDenied],
  );

  const handleSignOut = useCallback(async () => {
    const result = await signOut();
    if (result.pendingCount && result.pendingCount > 0) {
      Alert.alert(copy.pendingSignOutTitle, copy.pendingSignOutBody, [
        {
          text: copy.staySignedIn,
          style: 'cancel',
        },
        {
          text: t().common.retry,
          onPress: () => void retry(),
        },
        {
          text: copy.discardAndSignOut,
          style: 'destructive',
          onPress: async () => {
            await signOut({ discardPending: true });
            router.replace('/(auth)/login');
          },
        },
      ]);
      return;
    }
    router.replace('/(auth)/login');
  }, [signOut, copy, retry]);

  const handleDelete = useCallback(() => {
    Alert.alert(copy.deleteConfirmTitle, copy.deleteConfirmBody, [
      { text: t().common.cancel, style: 'cancel' },
      {
        text: copy.deleteConfirmAction,
        style: 'destructive',
        onPress: async () => {
          try {
            if (user?.id) {
              await cancelAllMappedReminders(user.id);
              await clearAccountLocalData(user.id);
            }
            await deleteMyAccount();
            router.replace('/(auth)/login');
          } catch (e) {
            Alert.alert(
              t().common.errorGeneric,
              e instanceof Error ? e.message : t().common.errorGeneric,
            );
          }
        },
      },
    ]);
  }, [copy, user?.id]);

  return (
    <Screen scroll>
      <View style={{ paddingTop: theme.space.sm, gap: theme.space.lg }}>
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <Text
            style={{
              fontFamily: theme.fonts.display,
              fontSize: theme.typography.title.fontSize,
              lineHeight: theme.typography.title.lineHeight,
              color: theme.colors.ink,
            }}
            allowFontScaling
          >
            {copy.title}
          </Text>
          <Pressable onPress={() => goBackOr()} hitSlop={12}>
            <Text
              style={{
                fontFamily: theme.fonts.bodyMedium,
                color: theme.colors.primary,
                fontSize: theme.typography.body.fontSize,
              }}
              allowFontScaling
            >
              {t().common.done}
            </Text>
          </Pressable>
        </View>

        <SyncBanner />

        <View style={{ gap: theme.space.sm }}>
          <ListRow
            title={copy.profile}
            subtitle={
              onboarding?.displayName
                ? `${onboarding.displayName}${user?.email ? ` · ${user.email}` : ''}`
                : (user?.email ?? '')
            }
            onPress={() => setProfileOpen(true)}
          />
          <ListRow
            title={copy.kitchen}
            subtitle={
              onboarding
                ? `${onboarding.kitchenName} · ${
                    kitchenMode === 'business'
                      ? t().onboarding.businessLabel
                      : t().onboarding.homeLabel
                  }`
                : ''
            }
            onPress={() => setKitchenOpen(true)}
          />
          <View
            style={{
              minHeight: 52,
              paddingVertical: theme.space.sm,
              paddingHorizontal: theme.space.md,
              borderRadius: theme.radii.sm,
              borderWidth: 1,
              borderColor: theme.colors.border,
              backgroundColor: theme.colors.white,
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: theme.space.md,
            }}
          >
            <View style={{ flex: 1, gap: 2 }}>
              <Text
                style={{
                  fontFamily: theme.fonts.bodyMedium,
                  color: theme.colors.ink,
                }}
              >
                {copy.reminders}
              </Text>
              <Text
                style={{
                  fontFamily: theme.fonts.body,
                  fontSize: theme.typography.caption.fontSize,
                  color: theme.colors.inkMuted,
                }}
              >
                {reminders ? copy.remindersOn : copy.remindersOff}
              </Text>
            </View>
            <Switch
              value={reminders}
              onValueChange={(v) => void onToggleReminders(v)}
              trackColor={{
                false: theme.colors.border,
                true: theme.colors.primaryMuted,
              }}
              thumbColor={theme.colors.white}
            />
          </View>
          <ListRow title={copy.version} subtitle={version} />
        </View>

        <Button
          label={copy.signOut}
          variant="secondary"
          onPress={() => void handleSignOut()}
        />

        <Button
          label={copy.deleteAccount}
          variant="danger"
          onPress={handleDelete}
        />
      </View>

      <Modal visible={profileOpen} transparent animationType="fade">
        <View
          style={{
            flex: 1,
            backgroundColor: theme.colors.overlay,
            justifyContent: 'flex-end',
          }}
        >
          <View
            style={{
              backgroundColor: theme.colors.canvas,
              padding: theme.space.lg,
              gap: theme.space.md,
              borderTopLeftRadius: theme.radii.lg,
              borderTopRightRadius: theme.radii.lg,
            }}
          >
            <Text
              style={{
                fontFamily: theme.fonts.display,
                fontSize: theme.typography.heading.fontSize,
                color: theme.colors.ink,
              }}
            >
              {copy.editProfile}
            </Text>
            <TextField
              label={t().common.displayName}
              value={displayName}
              onChangeText={setDisplayName}
            />
            <Button
              label={copy.saveProfile}
              loading={saving}
              onPress={async () => {
                if (!user?.id || !onboarding) return;
                setSaving(true);
                try {
                  await updateProfileDisplayName(user.id, displayName);
                  await setOnboardingDraft({
                    ...onboarding,
                    displayName: displayName.trim(),
                  });
                  setProfileOpen(false);
                } catch (e) {
                  Alert.alert(
                    t().common.errorGeneric,
                    e instanceof Error ? e.message : t().common.errorGeneric,
                  );
                } finally {
                  setSaving(false);
                }
              }}
            />
            <Button
              label={t().common.cancel}
              variant="ghost"
              onPress={() => setProfileOpen(false)}
            />
          </View>
        </View>
      </Modal>

      <Modal visible={kitchenOpen} transparent animationType="fade">
        <View
          style={{
            flex: 1,
            backgroundColor: theme.colors.overlay,
            justifyContent: 'flex-end',
          }}
        >
          <View
            style={{
              backgroundColor: theme.colors.canvas,
              padding: theme.space.lg,
              gap: theme.space.md,
              borderTopLeftRadius: theme.radii.lg,
              borderTopRightRadius: theme.radii.lg,
            }}
          >
            <Text
              style={{
                fontFamily: theme.fonts.display,
                fontSize: theme.typography.heading.fontSize,
                color: theme.colors.ink,
              }}
            >
              {copy.editKitchen}
            </Text>
            <TextField
              label={t().common.kitchenName}
              value={kitchenName}
              onChangeText={setKitchenName}
            />
            <Text
              style={{
                fontFamily: theme.fonts.label,
                color: theme.colors.inkSubtle,
                textTransform: 'uppercase',
              }}
            >
              {copy.kitchenKind}
            </Text>
            <View style={{ flexDirection: 'row', gap: theme.space.sm }}>
              {(['home', 'business'] as const).map((mode) => (
                <Pressable
                  key={mode}
                  onPress={() => setKind(mode)}
                  style={{
                    flex: 1,
                    padding: theme.space.md,
                    borderRadius: theme.radii.sm,
                    borderWidth: 1,
                    borderColor:
                      kind === mode
                        ? theme.colors.primary
                        : theme.colors.border,
                    backgroundColor:
                      kind === mode ? theme.colors.sand : theme.colors.white,
                  }}
                >
                  <Text
                    style={{
                      textAlign: 'center',
                      fontFamily: theme.fonts.bodyMedium,
                      color: theme.colors.ink,
                    }}
                  >
                    {mode === 'home'
                      ? t().onboarding.homeLabel
                      : t().onboarding.businessLabel}
                  </Text>
                </Pressable>
              ))}
            </View>
            <Button
              label={copy.saveKitchen}
              loading={saving}
              onPress={async () => {
                if (!kitchenId || !onboarding) return;
                setSaving(true);
                try {
                  const updated = await updateKitchen(kitchenId, {
                    name: kitchenName,
                    kind,
                    expectedRevision: onboarding.kitchenRevision ?? 1,
                  });
                  await setOnboardingDraft({
                    ...onboarding,
                    kitchenName: updated.name,
                    mode: updated.mode,
                    kitchenId: updated.id,
                    kitchenRevision: updated.revision,
                  });
                  await refreshOnboarding();
                  setKitchenOpen(false);
                } catch (e) {
                  Alert.alert(
                    t().common.errorGeneric,
                    e instanceof Error ? e.message : t().common.errorGeneric,
                  );
                } finally {
                  setSaving(false);
                }
              }}
            />
            <Button
              label={t().common.cancel}
              variant="ghost"
              onPress={() => setKitchenOpen(false)}
            />
          </View>
        </View>
      </Modal>
    </Screen>
  );
}
