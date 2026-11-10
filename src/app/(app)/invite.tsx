import { Text, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';

import {
  Button,
  IconButton,
  PaperCard,
  Screen,
  ScreenHeader,
  SectionChip,
} from '@/components/ui';
import { useTheme, type AppTheme } from '@/design';
import { useAuth } from '@/features/auth';
import { goBackOr } from '@/lib/navigation';
import { useT } from '@/i18n';

const noop = () => {};

function initialsFor(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  const first = parts[0][0] ?? '';
  const last = parts.length > 1 ? (parts[parts.length - 1][0] ?? '') : '';
  return (first + last).toUpperCase();
}

function ComingSoonBanner({ theme }: { theme: AppTheme }) {
  const t = useT();
  const copy = t().invite;
  return (
    <View
      accessibilityRole="text"
      accessibilityLabel={`${copy.comingSoonTitle}. ${copy.comingSoonBody}`}
      style={{
        flexDirection: 'row',
        alignItems: 'flex-start',
        gap: theme.space.md,
        padding: theme.space.lg,
        borderRadius: theme.radii.xl,
        backgroundColor: theme.colors.primaryTint,
      }}
    >
      <Ionicons name="time-outline" size={22} color={theme.colors.primary} />
      <View style={{ flex: 1, gap: 2 }}>
        <Text
          style={{
            fontFamily: theme.fonts.bodyExtraBold,
            fontSize: theme.typography.bodySmall.fontSize,
            lineHeight: theme.typography.bodySmall.lineHeight,
            color: theme.colors.primary,
          }}
          allowFontScaling
        >
          {copy.comingSoonTitle}
        </Text>
        <Text
          style={{
            fontFamily: theme.fonts.bodyMedium,
            fontSize: theme.typography.caption.fontSize,
            lineHeight: theme.typography.caption.lineHeight,
            color: theme.colors.ink,
          }}
          allowFontScaling
        >
          {copy.comingSoonBody}
        </Text>
      </View>
    </View>
  );
}

function InviteLinkCard({ theme }: { theme: AppTheme }) {
  const t = useT();
  const copy = t().invite;
  return (
    <PaperCard
      style={{
        borderRadius: theme.radii.xxl,
        padding: theme.space.xl,
        opacity: 0.55,
      }}
    >
      <View
        accessibilityState={{ disabled: true }}
        pointerEvents="none"
        style={{ gap: theme.space.lg }}
      >
        <Text
          style={{
            fontFamily: theme.fonts.bodyExtraBold,
            fontSize: theme.typography.chip.fontSize,
            lineHeight: theme.typography.chip.lineHeight,
            letterSpacing: 0.6,
            textTransform: 'uppercase',
            color: theme.colors.inkMuted,
          }}
          allowFontScaling
        >
          {copy.linkLabel}
        </Text>
        <View
          style={{
            padding: theme.space.lg,
            borderRadius: theme.radii.xl,
            backgroundColor: theme.colors.sand,
          }}
        >
          <Text
            style={{
              fontFamily: theme.fonts.bodyMedium,
              fontSize: 15,
              color: theme.colors.ink,
            }}
            numberOfLines={1}
            allowFontScaling
          >
            {copy.linkPlaceholder}
          </Text>
        </View>
        <View style={{ flexDirection: 'row', gap: theme.space.md }}>
          <Button
            label={copy.shareLink}
            icon="share-outline"
            onPress={noop}
            disabled
            compact
            style={{ flex: 1 }}
          />
          <Button
            label={copy.copy}
            icon="copy-outline"
            variant="secondary"
            onPress={noop}
            disabled
            compact
            style={{ flex: 1 }}
          />
        </View>
        <Text
          style={{
            fontFamily: theme.fonts.body,
            fontSize: theme.typography.caption.fontSize,
            lineHeight: theme.typography.caption.lineHeight,
            color: theme.colors.inkMuted,
          }}
          allowFontScaling
        >
          {copy.linkNote}
        </Text>
      </View>
    </PaperCard>
  );
}

function EmailInviteRow({ theme }: { theme: AppTheme }) {
  const t = useT();
  const copy = t().invite;
  return (
    <View
      accessibilityState={{ disabled: true }}
      pointerEvents="none"
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: theme.space.sm,
        opacity: 0.55,
      }}
    >
      <View
        style={{
          flex: 1,
          minHeight: 52,
          justifyContent: 'center',
          paddingHorizontal: theme.space.lg,
          borderRadius: 24,
          borderWidth: 0.5,
          borderColor: theme.colors.border,
          backgroundColor: theme.colors.white,
        }}
      >
        <Text
          style={{
            fontFamily: theme.fonts.bodyMedium,
            fontSize: theme.typography.body.fontSize,
            color: theme.colors.inkSubtle,
          }}
          numberOfLines={1}
          allowFontScaling
        >
          {copy.emailPlaceholder}
        </Text>
      </View>
      <View
        accessibilityRole="button"
        accessibilityLabel={copy.send}
        accessibilityState={{ disabled: true }}
        style={{
          minHeight: 44,
          paddingHorizontal: theme.space.lg,
          borderRadius: theme.radii.pill,
          backgroundColor: theme.colors.primary,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Text
          style={{
            fontFamily: theme.fonts.bodyBold,
            fontSize: theme.typography.bodySmall.fontSize,
            color: '#FFFFFF',
            includeFontPadding: false,
          }}
          allowFontScaling
        >
          {copy.send}
        </Text>
      </View>
    </View>
  );
}

function MemberRow({
  theme,
  name,
  email,
}: {
  theme: AppTheme;
  name: string;
  email?: string;
}) {
  const t = useT();
  const copy = t().invite;
  return (
    <View
      accessible
      accessibilityLabel={[name, copy.you, email, copy.owner].filter(Boolean).join(', ')}
      style={{
        minHeight: 72,
        flexDirection: 'row',
        alignItems: 'center',
        gap: theme.space.md,
        paddingVertical: theme.space.md,
        paddingHorizontal: theme.space.xl - 4,
      }}
    >
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
            fontSize: theme.typography.bodySmall.fontSize,
            color: theme.colors.frequency.daily.text,
          }}
          allowFontScaling={false}
        >
          {initialsFor(name)}
        </Text>
      </View>
      <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
        <Text
          style={{
            fontFamily: theme.fonts.bodyBold,
            fontSize: theme.typography.body.fontSize,
            lineHeight: 22,
            color: theme.colors.ink,
          }}
          numberOfLines={1}
          allowFontScaling
        >
          {name}
          <Text style={{ fontFamily: theme.fonts.bodyMedium, color: theme.colors.inkMuted }}>
            {` · ${copy.you}`}
          </Text>
        </Text>
        {email ? (
          <Text
            style={{
              fontFamily: theme.fonts.bodyMedium,
              fontSize: theme.typography.caption.fontSize,
              lineHeight: theme.typography.caption.lineHeight,
              color: theme.colors.inkMuted,
            }}
            numberOfLines={1}
            allowFontScaling
          >
            {email}
          </Text>
        ) : null}
      </View>
      <View
        style={{
          paddingVertical: 4,
          paddingHorizontal: 10,
          borderRadius: 8,
          backgroundColor: theme.colors.primaryTint,
        }}
      >
        <Text
          style={{
            fontFamily: theme.fonts.bodyExtraBold,
            fontSize: 10,
            letterSpacing: 0.6,
            textTransform: 'uppercase',
            color: theme.colors.primary,
          }}
          allowFontScaling
        >
          {copy.owner}
        </Text>
      </View>
    </View>
  );
}

export default function InviteScreen() {
  const t = useT();
  const theme = useTheme();
  const { user, onboarding } = useAuth();
  const copy = t().invite;

  const email = user?.email ?? undefined;
  const name = onboarding?.displayName?.trim() || email || '';

  return (
    <Screen scroll contentStyle={{ paddingBottom: theme.space.xxxl }}>
      <View style={{ gap: theme.space.xl }}>
        <View style={{ alignSelf: 'flex-start' }}>
          <IconButton
            name="chevron-back"
            accessibilityLabel={t().common.back}
            onPress={() => goBackOr()}
          />
        </View>

        <View style={{ gap: theme.space.sm }}>
          <ScreenHeader
            size="display"
            eyebrow={onboarding?.kitchenName || undefined}
            title={copy.title}
          />
          <Text
            style={{
              fontFamily: theme.fonts.body,
              fontSize: theme.typography.body.fontSize,
              lineHeight: theme.typography.body.lineHeight,
              color: theme.colors.inkMuted,
            }}
            allowFontScaling
          >
            {copy.subtitle}
          </Text>
        </View>

        <ComingSoonBanner theme={theme} />

        <InviteLinkCard theme={theme} />

        <View style={{ gap: theme.space.md }}>
          <SectionChip label={copy.byEmail} />
          <EmailInviteRow theme={theme} />
        </View>

        <View style={{ gap: theme.space.md }}>
          <SectionChip
            label={copy.members.replace('{count}', '1')}
            chipTone={{ background: theme.colors.primary, text: '#FFFFFF' }}
          />
          <PaperCard style={{ borderRadius: theme.radii.xxl }}>
            <MemberRow theme={theme} name={name} email={email !== name ? email : undefined} />
          </PaperCard>
        </View>
      </View>
    </Screen>
  );
}
