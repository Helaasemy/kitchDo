import { useCallback, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import {
  Alert,
  Linking,
  Share,
  Switch,
  Text,
  View,
} from 'react-native';
import * as Clipboard from 'expo-clipboard';
import QRCode from 'react-native-qrcode-svg';

import {
  Button,
  IconButton,
  PaperCard,
  Screen,
  ScreenHeader,
  SectionChip,
  TextField,
} from '@/components/ui';
import { useTheme } from '@/design';
import { useAuth } from '@/features/auth';
import { isPeopleLimitError, usePlanPaywall } from '@/features/billing';
import {
  canLeaveKitchen,
  createKitchenInvite,
  formatJoinCode,
  joinDeepLink,
  leaveKitchen,
  listKitchenInvites,
  listKitchenMembers,
  removeMember,
  revokeKitchenInvite,
  updateMemberPermissions,
  type KitchenInvite,
  type KitchenMember,
} from '@/features/membership';
import { goBackOr } from '@/lib/navigation';
import { useT } from '@/i18n';

export default function InviteScreen() {
  const t = useT();
  const theme = useTheme();
  const {
    user,
    onboarding,
    kitchenId,
    isAdmin,
    kitchens,
    switchKitchen,
    refreshOnboarding,
  } = useAuth();
  const copy = t().invite;
  const userId = user?.id;
  const { guardPeople, paywall, plan } = usePlanPaywall();
  const paid = plan !== 'free';

  const [canComplete, setCanComplete] = useState(true);
  const [canEdit, setCanEdit] = useState(false);
  const [invite, setInvite] = useState<KitchenInvite | null>(null);
  const [members, setMembers] = useState<KitchenMember[]>([]);
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);

  const myRow = members.find((member) => member.userId === userId);
  const admin = isAdmin || myRow?.role === 'admin';

  const reload = useCallback(async () => {
    if (!kitchenId) return;
    const nextMembers = await listKitchenMembers(kitchenId);
    const amAdmin =
      isAdmin || nextMembers.some((member) => member.userId === userId && member.role === 'admin');
    const invites = amAdmin && plan !== 'free' ? await listKitchenInvites(kitchenId) : [];
    setMembers(nextMembers);
    setInvite(invites[0] ?? null);
  }, [kitchenId, isAdmin, userId, plan]);

  useFocusEffect(
    useCallback(() => {
      void refreshOnboarding();
      void reload().catch((e) => {
        Alert.alert(t().common.errorGeneric, e instanceof Error ? e.message : undefined);
      });
    }, [reload, refreshOnboarding, t]),
  );

  const code = invite ? formatJoinCode(invite.code) : null;
  const deepLink = invite ? joinDeepLink(invite.code) : null;

  const generate = async () => {
    if (!kitchenId) return;
    if (!guardPeople(members.length)) return;
    setBusy(true);
    try {
      const next = await createKitchenInvite({
        kitchenId,
        canComplete,
        canEditTemplates: canEdit,
      });
      setInvite(next);
    } catch (e) {
      const raw = e instanceof Error ? e.message : copy.networkRequired;
      if (isPeopleLimitError(raw)) {
        guardPeople(members.length);
        return;
      }
      Alert.alert(copy.joinFailed, raw);
    } finally {
      setBusy(false);
    }
  };

  const copyCode = async () => {
    if (!code) return;
    await Clipboard.setStringAsync(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const onLeft = async (nextId?: string) => {
    if (nextId) await switchKitchen(nextId);
    goBackOr('/(app)/settings');
  };

  return (
    <Screen scroll contentStyle={{ paddingBottom: theme.space.xxxl }}>
      <View style={{ gap: theme.space.xl }}>
        <IconButton
          name="chevron-back"
          accessibilityLabel={t().common.back}
          onPress={() => goBackOr()}
        />
        <ScreenHeader
          size="display"
          eyebrow={onboarding?.kitchenName}
          title={copy.title}
        />
        <Text
          style={{
            fontFamily: theme.fonts.body,
            fontSize: theme.typography.body.fontSize,
            color: theme.colors.inkMuted,
          }}
        >
          {admin ? copy.subtitle : copy.cannotInvite}
        </Text>

        {admin ? (
        <View style={{ gap: theme.space.md }}>
          <ToggleRow
            label={copy.canComplete}
            value={canComplete}
            onValueChange={setCanComplete}
          />
          <ToggleRow
            label={copy.canEditTemplates}
            value={canEdit}
            onValueChange={setCanEdit}
          />
          <Button
            label={invite ? copy.generateAnother : copy.generateCode}
            onPress={() => void generate()}
            loading={busy}
          />
        </View>
        ) : null}

        {admin && paid && invite && code && deepLink ? (
          <PaperCard style={{ borderRadius: theme.radii.xxl, padding: theme.space.xl, gap: theme.space.lg }}>
            <Text
              style={{
                fontFamily: theme.fonts.bodyExtraBold,
                letterSpacing: 0.6,
                textTransform: 'uppercase',
                color: theme.colors.inkMuted,
              }}
            >
              {copy.linkLabel}
            </Text>
            <Text
              style={{
                fontFamily: theme.fonts.bodyBold,
                fontSize: 28,
                letterSpacing: 2,
                color: theme.colors.ink,
              }}
            >
              {code}
            </Text>
            <View style={{ alignItems: 'center', paddingVertical: theme.space.md }}>
              <QRCode value={deepLink} size={180} />
            </View>
            <View style={{ flexDirection: 'row', gap: theme.space.md }}>
              <Button
                label={copy.shareLink}
                icon="share-outline"
                onPress={() => void Share.share({ message: `${code}\n${deepLink}` })}
                compact
                style={{ flex: 1 }}
              />
              <Button
                label={copied ? t().common.copied : copy.copy}
                icon="copy-outline"
                variant="secondary"
                onPress={() => void copyCode()}
                compact
                style={{ flex: 1 }}
              />
            </View>
            <Button
              label={copy.revoke}
              variant="ghost"
              onPress={() => {
                void revokeKitchenInvite(invite.id).then(() => {
                  setInvite(null);
                  void reload();
                });
              }}
            />
            <Text
              style={{
                fontFamily: theme.fonts.body,
                fontSize: theme.typography.caption.fontSize,
                color: theme.colors.inkMuted,
              }}
            >
              {copy.linkNote}
            </Text>
          </PaperCard>
        ) : null}

        {admin && paid ? (
        <View style={{ gap: theme.space.md }}>
          <SectionChip label={copy.byEmail} />
          <View style={{ flexDirection: 'row', gap: theme.space.sm, alignItems: 'flex-end' }}>
            <View style={{ flex: 1 }}>
              <TextField
                label={copy.emailPlaceholder}
                value={email}
                onChangeText={setEmail}
                autoCapitalize="none"
                keyboardType="email-address"
              />
            </View>
            <Button
              label={copy.send}
              compact
              disabled={!code || !email.trim()}
              onPress={() => {
                if (!code) return;
                const subject = encodeURIComponent(copy.emailSubject);
                const body = encodeURIComponent(
                  copy.emailBody
                    .replace('{kitchen}', onboarding?.kitchenName ?? '')
                    .replace('{code}', code),
                );
                void Linking.openURL(`mailto:${email.trim()}?subject=${subject}&body=${body}`);
              }}
            />
          </View>
        </View>
        ) : null}

        <MemberList
          members={members}
          userId={userId}
          isAdmin={Boolean(admin)}
          kitchenId={kitchenId}
          onChanged={reload}
          otherKitchenId={kitchens.find((k) => k.kitchenId !== kitchenId)?.kitchenId}
          onLeft={onLeft}
        />
      </View>
      {paywall}
    </Screen>
  );
}

function ToggleRow({
  label,
  value,
  onValueChange,
}: {
  label: string;
  value: boolean;
  onValueChange: (next: boolean) => void;
}) {
  const theme = useTheme();
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        minHeight: 52,
      }}
    >
      <Text style={{ fontFamily: theme.fonts.bodyMedium, color: theme.colors.ink, flex: 1 }}>
        {label}
      </Text>
      <Switch value={value} onValueChange={onValueChange} />
    </View>
  );
}

function MemberList({
  members,
  userId,
  isAdmin,
  kitchenId,
  onChanged,
  otherKitchenId,
  onLeft,
}: {
  members: KitchenMember[];
  userId?: string;
  isAdmin: boolean;
  kitchenId: string | null;
  onChanged: () => Promise<void>;
  otherKitchenId?: string;
  onLeft: (nextKitchenId?: string) => Promise<void>;
}) {
  const t = useT();
  const theme = useTheme();
  const copy = t().invite;
  const adminCount = members.filter((m) => m.role === 'admin').length;
  const mine = members.find((member) => member.userId === userId);
  const showLeave =
    Boolean(kitchenId) &&
    members.length > 1 &&
    Boolean(mine) &&
    canLeaveKitchen({
      isAdmin: mine?.role === 'admin',
      adminCount,
      memberCount: members.length,
    });

  return (
    <View style={{ gap: theme.space.md }}>
      <SectionChip
        label={copy.members.replace('{count}', String(members.length))}
        chipTone={{ background: theme.colors.primary, text: '#FFFFFF' }}
      />
      <PaperCard style={{ borderRadius: theme.radii.xxl }}>
        {members.map((member) => {
          const mine = member.userId === userId;
          return (
            <View
              key={member.userId}
              style={{
                padding: theme.space.lg,
                gap: theme.space.sm,
                borderBottomWidth: 0.5,
                borderBottomColor: theme.colors.border,
              }}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.space.md }}>
                <View
                  style={{
                    width: 40,
                    height: 40,
                    borderRadius: 20,
                    backgroundColor: theme.colors.frequency.daily.tint,
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Text
                    style={{
                      fontFamily: theme.fonts.bodyBold,
                      color: theme.colors.frequency.daily.text,
                    }}
                  >
                    {member.displayName.slice(0, 1).toUpperCase()}
                  </Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontFamily: theme.fonts.bodyBold, color: theme.colors.ink }}>
                    {member.displayName}
                    {mine ? ` · ${copy.you}` : ''}
                  </Text>
                  <Text
                    style={{
                      fontFamily: theme.fonts.bodyMedium,
                      fontSize: theme.typography.caption.fontSize,
                      color: theme.colors.inkMuted,
                    }}
                  >
                    {member.role === 'admin' ? copy.owner : copy.permissions}
                  </Text>
                </View>
              </View>
              {isAdmin && !mine && member.role !== 'admin' && kitchenId ? (
                <View style={{ gap: theme.space.sm }}>
                  <ToggleRow
                    label={copy.canComplete}
                    value={member.canComplete}
                    onValueChange={(next) => {
                      void updateMemberPermissions({
                        kitchenId,
                        userId: member.userId,
                        canComplete: next,
                        canEditTemplates: member.canEditTemplates,
                      }).then(onChanged);
                    }}
                  />
                  <ToggleRow
                    label={copy.canEditTemplates}
                    value={member.canEditTemplates}
                    onValueChange={(next) => {
                      void updateMemberPermissions({
                        kitchenId,
                        userId: member.userId,
                        canComplete: member.canComplete,
                        canEditTemplates: next,
                      }).then(onChanged);
                    }}
                  />
                  <Button
                    label={copy.remove}
                    variant="ghost"
                    compact
                    onPress={() => {
                      if (!kitchenId) return;
                      void removeMember(kitchenId, member.userId).then(onChanged);
                    }}
                  />
                </View>
              ) : null}
            </View>
          );
        })}
      </PaperCard>
      {showLeave ? (
        <Button
          label={copy.leave}
          variant="ghost"
          onPress={() => {
            if (!kitchenId) return;
            void leaveKitchen(kitchenId).then(() => onLeft(otherKitchenId));
          }}
        />
      ) : null}
    </View>
  );
}
