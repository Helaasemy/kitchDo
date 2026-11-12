import { useCallback, useEffect, useState } from 'react';
import { DateTime } from 'luxon';
import {
  Alert,
  Modal,
  Pressable,
  Switch,
  Text,
  View,
} from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import Constants from 'expo-constants';
import { router } from 'expo-router';

import {
  Button,
  IconTile,
  ListRow,
  Screen,
  Sheet,
  SyncBanner,
  TextField,
} from '@/components/ui';
import { useAppearance, useTheme } from '@/design';
import { useAuth } from '@/features/auth';
import { PLAN_LIMITS, usePlanPaywall } from '@/features/billing';
import { KitchenSwitcher } from '@/features/membership/KitchenSwitcher';
import {
  updateKitchen,
  updateProfileDisplayName,
} from '@/features/kitchens/api';
import {
  deleteAccountCompletely,
  getRemindersEnabled,
  setRemindersEnabled,
} from '@/features/settings/api';
import { errorMessage } from '@/lib/errors';
import { goBackOr } from '@/lib/navigation';
import {
  listLocalBackups,
  restoreLocalBackup,
} from '@/lib/storage';
import { useSync } from '@/lib/sync';
import {
  APP_LOCALES,
  LOCALE_LABELS,
  useI18n,
  useT,
  type KitchenMode,
} from '@/i18n';

export default function SettingsScreen() {
  const t = useT();
  const { locale, setPreference } = useI18n();
  const theme = useTheme();
  const { preference: appearance, setPreference: setAppearance } = useAppearance();
  const selectedScheme = appearance === 'system' ? theme.scheme : appearance;
  const {
    signOut,
    onboarding,
    user,
    kitchenMode,
    kitchenId,
    isAdmin,
    refreshOnboarding,
    setOnboardingDraft,
  } = useAuth();
  const { retry } = useSync();
  const { plan, openManage, paywall } = usePlanPaywall();
  const userId = user?.id;
  const copy = t().settings;
  const billing = t().billing;
  const planName =
    plan === 'light' ? billing.light : plan === 'pro' ? billing.pro : billing.free;
  const planLimits = PLAN_LIMITS[plan];
  const planHint =
    planLimits.lists == null
      ? billing.hintUnlimited
          .replace('{plan}', planName)
          .replace('{people}', String(planLimits.people))
      : billing.hintCapped
          .replace('{plan}', planName)
          .replace('{lists}', String(planLimits.lists))
          .replace('{people}', String(planLimits.people));
  const version =
    Constants.expoConfig?.version ?? Constants.nativeAppVersion ?? '1.0.0';

  const [reminders, setReminders] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [kitchenOpen, setKitchenOpen] = useState(false);
  const [switcherOpen, setSwitcherOpen] = useState(false);
  const [languageOpen, setLanguageOpen] = useState(false);
  const [appearanceOpen, setAppearanceOpen] = useState(false);
  const [displayName, setDisplayName] = useState(onboarding?.displayName ?? '');
  const [kitchenName, setKitchenName] = useState(onboarding?.kitchenName ?? '');
  const [kind, setKind] = useState<KitchenMode>(kitchenMode);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!userId) return;
    void getRemindersEnabled(userId)
      .then(setReminders)
      .catch(() => undefined);
  }, [userId]);

  const [syncedOnboarding, setSyncedOnboarding] = useState(onboarding);
  if (syncedOnboarding !== onboarding) {
    setSyncedOnboarding(onboarding);
    setDisplayName(onboarding?.displayName ?? '');
    setKitchenName(onboarding?.kitchenName ?? '');
    setKind(onboarding?.mode ?? 'home');
  }

  const onToggleReminders = useCallback(
    async (next: boolean) => {
      if (!userId || !kitchenId) return;
      try {
        const result = await setRemindersEnabled({
          userId,
          kitchenId,
          enabled: next,
        });
        setReminders(result.enabled);
        if (result.permissionDenied) {
          Alert.alert(copy.reminders, copy.remindersPermissionDenied);
        }
      } catch (e) {
        Alert.alert(t().common.errorGeneric, errorMessage(e));
      }
    },
    [userId, kitchenId, copy.reminders, copy.remindersPermissionDenied, t],
  );

  const handleSignOut = useCallback(async () => {
    try {
      const result = await signOut();
      if (result.error) {
        Alert.alert(copy.signOutFailed, result.error);
        return;
      }
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
            onPress: () => {
              void signOut({ discardPending: true }).then((r) => {
                if (r.error) Alert.alert(copy.signOutFailed, r.error);
              });
            },
          },
        ]);
      }
    } catch (e) {
      Alert.alert(copy.signOutFailed, errorMessage(e));
    }
  }, [signOut, copy, retry, t]);

  const handleDelete = useCallback(() => {
    Alert.alert(copy.deleteConfirmTitle, copy.deleteConfirmBody, [
      { text: t().common.cancel, style: 'cancel' },
      {
        text: copy.deleteConfirmAction,
        style: 'destructive',
        onPress: async () => {
          if (!userId) return;
          try {
            await deleteAccountCompletely(userId);
          } catch (e) {
            Alert.alert(t().common.errorGeneric, errorMessage(e));
          }
        },
      },
    ]);
  }, [copy, userId, t]);

  const handleRestore = useCallback(async () => {
    if (!userId) return;
    try {
      const backups = await listLocalBackups(userId);
      const latest = backups[0];
      if (!latest) {
        Alert.alert(copy.restoreRoutines, copy.restoreNone);
        return;
      }
      const when = DateTime.fromISO(latest.createdAt).toRelative() ?? latest.createdAt;
      Alert.alert(
        copy.restoreConfirmTitle,
        copy.restoreConfirmBody.replace('{when}', when),
        [
          { text: t().common.cancel, style: 'cancel' },
          {
            text: copy.restoreConfirmAction,
            onPress: async () => {
              try {
                await restoreLocalBackup(userId, latest.id);
                Alert.alert(copy.restoreRoutines, copy.restoreDone);
              } catch (e) {
                Alert.alert(t().common.errorGeneric, errorMessage(e));
              }
            },
          },
        ],
      );
    } catch (e) {
      Alert.alert(t().common.errorGeneric, errorMessage(e));
    }
  }, [userId, copy, t]);

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
            onPress={() => setSwitcherOpen(true)}
          />
          {isAdmin ? (
            <ListRow
              title={copy.editKitchen}
              subtitle={copy.kitchen}
              onPress={() => setKitchenOpen(true)}
            />
          ) : null}
          <ListRow
            title={copy.plan}
            subtitle={planHint}
            left={
              <IconTile
                name="diamond-outline"
                size={40}
                round
                background={theme.colors.frequency.daily.tint}
                color={theme.colors.frequency.daily.text}
              />
            }
            onPress={openManage}
          />
          <ListRow
            title={copy.invitePeople}
            subtitle={copy.invitePeopleHint}
            left={
              <IconTile
                name="people-outline"
                size={40}
                round
                background={theme.colors.frequency.weekly.tint}
                color={theme.colors.frequency.weekly.text}
              />
            }
            onPress={() => router.push('/(app)/invite')}
          />
          <ListRow
            title={copy.restoreRoutines}
            subtitle={copy.restoreRoutinesHint}
            left={
              <IconTile
                name="refresh-outline"
                size={40}
                round
                background={theme.colors.frequency.monthly.tint}
                color={theme.colors.frequency.monthly.text}
              />
            }
            onPress={() => void handleRestore()}
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
          <View
            style={{
              paddingVertical: theme.space.md,
              paddingHorizontal: theme.space.md,
              borderRadius: theme.radii.sm,
              borderWidth: 1,
              borderColor: theme.colors.border,
              backgroundColor: theme.colors.white,
              gap: theme.space.md,
            }}
          >
            <View style={{ gap: 2 }}>
              <Text
                style={{
                  fontFamily: theme.fonts.bodyMedium,
                  color: theme.colors.ink,
                }}
              >
                {copy.language}
              </Text>
              <Text
                style={{
                  fontFamily: theme.fonts.body,
                  fontSize: theme.typography.caption.fontSize,
                  color: theme.colors.inkMuted,
                }}
              >
                {copy.languageHint}
              </Text>
            </View>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={copy.language}
              accessibilityValue={{
                text: LOCALE_LABELS[locale],
              }}
              onPress={() => setLanguageOpen(true)}
              style={({ pressed }) => ({
                minHeight: 44,
                paddingHorizontal: theme.space.lg,
                paddingVertical: theme.space.sm,
                borderRadius: theme.radii.sm,
                borderWidth: 1,
                borderColor: theme.colors.border,
                backgroundColor: pressed ? theme.colors.sand : theme.colors.canvas,
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: theme.space.sm,
              })}
            >
              <Text
                style={{
                  flex: 1,
                  fontFamily: theme.fonts.bodyMedium,
                  fontSize: theme.typography.body.fontSize,
                  color: theme.colors.ink,
                }}
                numberOfLines={1}
                allowFontScaling
              >
                {LOCALE_LABELS[locale]}
              </Text>
              <Ionicons
                name="chevron-down"
                size={18}
                color={theme.colors.inkSubtle}
              />
            </Pressable>
          </View>
          <ListRow
            title={copy.appearance}
            subtitle={
              selectedScheme === 'dark'
                ? copy.appearanceDark
                : copy.appearanceLight
            }
            left={
              <IconTile
                name={selectedScheme === 'dark' ? 'moon' : 'sunny-outline'}
                size={40}
                round
                background={theme.colors.frequency.weekly.tint}
                color={theme.colors.frequency.weekly.text}
              />
            }
            onPress={() => setAppearanceOpen(true)}
          />
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

      <Sheet
        visible={languageOpen}
        title={copy.language}
        onClose={() => setLanguageOpen(false)}
      >
        {APP_LOCALES.map((id) => {
          const selected = locale === id;
          return (
            <Pressable
              key={id}
              accessibilityRole="radio"
              accessibilityState={{ selected }}
              onPress={() => {
                void setPreference(id);
                setLanguageOpen(false);
              }}
              style={({ pressed }) => ({
                minHeight: 52,
                paddingHorizontal: theme.space.md,
                borderRadius: theme.radii.md,
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: theme.space.sm,
                backgroundColor: selected
                  ? theme.colors.primaryTint
                  : pressed
                    ? theme.colors.sand
                    : 'transparent',
              })}
            >
              <Text
                style={{
                  flex: 1,
                  fontFamily: selected
                    ? theme.fonts.bodySemiBold
                    : theme.fonts.bodyMedium,
                  fontSize: theme.typography.body.fontSize,
                  color: theme.colors.ink,
                }}
                allowFontScaling
              >
                {LOCALE_LABELS[id]}
              </Text>
              {selected ? (
                <Ionicons
                  name="checkmark"
                  size={20}
                  color={theme.colors.primary}
                />
              ) : null}
            </Pressable>
          );
        })}
      </Sheet>

      <Sheet
        visible={appearanceOpen}
        title={copy.appearance}
        onClose={() => setAppearanceOpen(false)}
      >
        {(
          [
            { id: 'light' as const, label: copy.appearanceLight },
            { id: 'dark' as const, label: copy.appearanceDark },
          ] as const
        ).map((option) => {
          const selected = selectedScheme === option.id;
          return (
            <Pressable
              key={option.id}
              accessibilityRole="radio"
              accessibilityState={{ selected }}
              onPress={() => {
                void setAppearance(option.id);
                setAppearanceOpen(false);
              }}
              style={({ pressed }) => ({
                minHeight: 52,
                paddingHorizontal: theme.space.md,
                borderRadius: theme.radii.md,
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: theme.space.sm,
                backgroundColor: selected
                  ? theme.colors.primaryTint
                  : pressed
                    ? theme.colors.sand
                    : 'transparent',
              })}
            >
              <Text
                style={{
                  flex: 1,
                  fontFamily: selected
                    ? theme.fonts.bodySemiBold
                    : theme.fonts.bodyMedium,
                  fontSize: theme.typography.body.fontSize,
                  color: theme.colors.ink,
                }}
                allowFontScaling
              >
                {option.label}
              </Text>
              {selected ? (
                <Ionicons
                  name="checkmark"
                  size={20}
                  color={theme.colors.primary}
                />
              ) : null}
            </Pressable>
          );
        })}
      </Sheet>

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
      <KitchenSwitcher visible={switcherOpen} onClose={() => setSwitcherOpen(false)} />
      {paywall}
    </Screen>
  );
}
