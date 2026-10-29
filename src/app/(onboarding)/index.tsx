import { useMemo, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { router } from 'expo-router';

import { BrandMark, Button, Screen, TextField } from '@/components/ui';
import { useTheme } from '@/design';
import { useAuth } from '@/features/auth';
import { getDeviceTimeZone } from '@/lib/dates';
import { t, type KitchenMode } from '@/i18n';

export default function OnboardingScreen() {
  const theme = useTheme();
  const { finishOnboarding, user } = useAuth();
  const copy = t().onboarding;
  const [mode, setMode] = useState<KitchenMode | null>(null);
  const [displayName, setDisplayName] = useState('');
  const [kitchenName, setKitchenName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const zone = useMemo(() => getDeviceTimeZone(), []);

  const applyMode = (next: KitchenMode) => {
    setMode(next);
    if (!displayName) {
      setDisplayName(
        next === 'home'
          ? copy.displayNamePlaceholderHome
          : copy.displayNamePlaceholderBusiness,
      );
    }
    if (!kitchenName) {
      setKitchenName(
        next === 'home'
          ? copy.kitchenPlaceholderHome
          : copy.kitchenPlaceholderBusiness,
      );
    }
  };

  const onFinish = async () => {
    setError(null);
    if (!mode) {
      setError('Choose Home or Business to continue.');
      return;
    }
    if (!displayName.trim() || !kitchenName.trim()) {
      setError('Add your name and a kitchen name.');
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
      return;
    }
    router.replace('/(app)/(tabs)/today');
  };

  return (
    <Screen scroll>
      <View style={{ marginTop: theme.space.xl, gap: theme.space.xl }}>
        <BrandMark size="md" />

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

        {mode ? (
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
              autoComplete="name"
              textContentType="name"
            />
            <TextField
              label={t().common.kitchenName}
              value={kitchenName}
              onChangeText={setKitchenName}
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

        {error ? (
          <Text
            style={{
              fontFamily: theme.fonts.body,
              color: theme.colors.coral,
              fontSize: theme.typography.caption.fontSize,
            }}
            allowFontScaling
          >
            {error}
          </Text>
        ) : null}

        <Button
          label={copy.finish}
          onPress={onFinish}
          loading={loading}
          disabled={!mode}
        />
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
