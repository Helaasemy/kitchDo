import { useEffect, useState } from 'react';
import * as Linking from 'expo-linking';
import { router } from 'expo-router';
import { Text, View } from 'react-native';

import { BrandMark, Button, Screen, TextField } from '@/components/ui';
import { useTheme } from '@/design';
import { useAuth } from '@/features/auth';
import { getSupabase } from '@/lib/supabase';
import { t } from '@/i18n';

async function exchangeUrl(url: string): Promise<string | null> {
  const parsed = Linking.parse(url);
  const params = {
    ...parsed.queryParams,
  } as Record<string, string | undefined>;

  // Supabase may return tokens in the hash fragment.
  const hash = url.split('#')[1];
  if (hash) {
    for (const part of hash.split('&')) {
      const [k, v] = part.split('=');
      if (k && v) params[k] = decodeURIComponent(v);
    }
  }

  if (params.error_description || params.error) {
    return params.error_description ?? params.error ?? 'Auth callback failed.';
  }

  const access_token = params.access_token;
  const refresh_token = params.refresh_token;
  if (access_token && refresh_token) {
    const { error } = await getSupabase().auth.setSession({
      access_token,
      refresh_token,
    });
    return error?.message ?? null;
  }

  const code = params.code;
  if (code) {
    const { error } = await getSupabase().auth.exchangeCodeForSession(code);
    return error?.message ?? null;
  }

  return null;
}

export default function AuthCallbackScreen() {
  const theme = useTheme();
  const { updatePassword, status } = useAuth();
  const copy = t().auth;
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    let active = true;
    (async () => {
      const initial = await Linking.getInitialURL();
      const url = initial ?? Linking.createURL('auth/callback');
      const err = await exchangeUrl(url);
      if (!active) return;
      if (err) setError(err);
      setReady(true);
    })();

    const sub = Linking.addEventListener('url', ({ url }) => {
      void exchangeUrl(url).then((err) => {
        if (err) setError(err);
        setReady(true);
      });
    });

    return () => {
      active = false;
      sub.remove();
    };
  }, []);

  const onSubmit = async () => {
    setError(null);
    if (password.length < 8) {
      setError(copy.passwordTooShort);
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
    router.replace('/');
  };

  if (!ready) {
    return (
      <Screen>
        <View style={{ flex: 1, justifyContent: 'center' }}>
          <Text
            style={{
              fontFamily: theme.fonts.body,
              color: theme.colors.inkMuted,
            }}
            allowFontScaling
          >
            {t().common.loading}
          </Text>
        </View>
      </Screen>
    );
  }

  return (
    <Screen scroll>
      <View style={{ marginTop: theme.space.xxl, gap: theme.space.xl }}>
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
            {copy.resetTitle}
          </Text>
          {done ? (
            <Text
              style={{
                fontFamily: theme.fonts.body,
                color: theme.colors.inkMuted,
              }}
              allowFontScaling
            >
              {copy.resetSuccess}
            </Text>
          ) : null}
        </View>

        {status === 'unauthenticated' && !error ? (
          <Text
            style={{
              fontFamily: theme.fonts.body,
              color: theme.colors.inkMuted,
            }}
            allowFontScaling
          >
            Open the reset link from your email on this device.
          </Text>
        ) : (
          <View style={{ gap: theme.space.md }}>
            <TextField
              label={t().common.password}
              secureTextEntry
              autoComplete="new-password"
              textContentType="newPassword"
              value={password}
              onChangeText={setPassword}
            />
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
              label={copy.resetAction}
              onPress={onSubmit}
              loading={loading}
              disabled={status === 'unauthenticated'}
            />
          </View>
        )}
      </View>
    </Screen>
  );
}
