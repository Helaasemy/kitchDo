import { useMemo, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { router } from 'expo-router';

import { Button, ErrorText, Screen, TextField, Wordmark } from '@/components/ui';
import { useTheme } from '@/design';
import { useAuth } from '@/features/auth';
import { getDeviceTimeZone } from '@/lib/dates';
import { useT, type KitchenMode } from '@/i18n';

export default function OnboardingScreen() {
  const t = useT();
  const theme = useTheme();
  const { finishOnboarding, user } = useAuth();
  const copy = t().onboarding;
  const [path, setPath] = useState<'create' | null>(null);
  const [mode, setMode] = useState<KitchenMode | null>(null);
  const [displayName, setDisplayName] = useState('');
  const [kitchenName, setKitchenName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const zone = useMemo(() => getDeviceTimeZone(), []);

  const applyMode = (next: KitchenMode) => {
    setMode(next);
  };

  const onFinish = async () => {
    setError(null);
    if (!mode) {
      setError(copy.chooseMode);
      return;
    }
    if (!displayName.trim() || !kitchenName.trim()) {
      setError(copy.namesRequired);
      return;
    }
    setLoading(true);
    const result = await finishOnboarding({
      mode,
      displayName,
      kitchenName,
    });
    setLoading(false);
    if (result.error) {
      setError(result.error);
    }
  };

  return (
    <Screen scroll>
      <View style={{ marginTop: theme.space.xl, gap: theme.space.xl }}>
        <Wordmark size="md" />

        <View style={{ gap: theme.space.sm }}>
          <Text
            style={{
              fontFamily: theme.fonts.display,
              fontSize: theme.typography.title.fontSize,
              lineHeight: theme.typography.title.lineHeight,
              color: theme.colors.ink,
            }}
            allowFontScaling
          >
            {copy.whereTitle}
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
            {copy.whereSubtitle}
          </Text>
        </View>

        <View style={{ gap: theme.space.sm }}>
          <ModeCard
            selected={path === 'create'}
            title={copy.createKitchen}
            hint={copy.whereSubtitle}
            onPress={() => setPath('create')}
          />
          <ModeCard
            selected={false}
            title={copy.haveCode}
            hint={copy.joinSubtitle}
            onPress={() => router.push('/join')}
          />
        </View>

        {path === 'create' ? (
        <View style={{ gap: theme.space.sm }}>
          <ModeCard
            selected={mode === 'home'}
            title={copy.homeLabel}
            hint={copy.homeHint}
            onPress={() => applyMode('home')}
          />
          <ModeCard
            selected={mode === 'business'}
            title={copy.businessLabel}
            hint={copy.businessHint}
            onPress={() => applyMode('business')}
          />
        </View>
        ) : null}

        {path === 'create' && mode ? (
          <View style={{ gap: theme.space.md }}>
            <Text
              style={{
                fontFamily: theme.fonts.displayRegular,
                fontSize: theme.typography.heading.fontSize,
                color: theme.colors.ink,
              }}
              allowFontScaling
            >
              {copy.profileTitle}
            </Text>
            <Text
              style={{
                fontFamily: theme.fonts.body,
                fontSize: theme.typography.bodySmall.fontSize,
                color: theme.colors.inkMuted,
              }}
              allowFontScaling
            >
              {mode === 'home'
                ? copy.profileSubtitleHome
                : copy.profileSubtitleBusiness}
            </Text>
            <TextField
              label={t().common.displayName}
              value={displayName}
              onChangeText={setDisplayName}
              placeholder={
                mode === 'home'
                  ? copy.displayNamePlaceholderHome
                  : copy.displayNamePlaceholderBusiness
              }
              autoComplete="name"
              textContentType="name"
            />
            <TextField
              label={t().common.kitchenName}
              value={kitchenName}
              onChangeText={setKitchenName}
              placeholder={
                mode === 'home'
                  ? copy.kitchenPlaceholderHome
                  : copy.kitchenPlaceholderBusiness
              }
            />
            <Text
              style={{
                fontFamily: theme.fonts.labelRegular,
                fontSize: theme.typography.label.fontSize,
                color: theme.colors.inkSubtle,
              }}
              allowFontScaling
            >
              {copy.timezoneNote} ({zone})
              {user?.email ? ` · ${user.email}` : ''}
            </Text>
          </View>
        ) : null}

        <ErrorText message={error} boxed />

        {path === 'create' ? (
          <Button
            label={copy.finish}
            onPress={onFinish}
            loading={loading}
            disabled={!mode}
          />
        ) : null}
      </View>
    </Screen>
  );
}

function ModeCard({
  selected,
  title,
  hint,
  onPress,
}: {
  selected: boolean;
  title: string;
  hint: string;
  onPress: () => void;
}) {
  const theme = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected }}
      onPress={onPress}
      style={{
        padding: theme.space.lg,
        borderRadius: theme.radii.lg,
        borderWidth: 1.5,
        borderColor: selected ? theme.colors.primary : theme.colors.border,
        backgroundColor: selected ? theme.colors.sand : theme.colors.white,
        gap: theme.space.xs,
      }}
    >
      <Text
        style={{
          fontFamily: theme.fonts.bodySemiBold,
          fontSize: theme.typography.body.fontSize,
          color: theme.colors.ink,
        }}
        allowFontScaling
      >
        {title}
      </Text>
      <Text
        style={{
          fontFamily: theme.fonts.body,
          fontSize: theme.typography.bodySmall.fontSize,
          lineHeight: theme.typography.bodySmall.lineHeight,
          color: theme.colors.inkMuted,
        }}
        allowFontScaling
      >
        {hint}
      </Text>
    </Pressable>
  );
}
