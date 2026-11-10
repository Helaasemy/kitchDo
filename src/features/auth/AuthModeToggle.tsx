import { Pressable, Text, View } from 'react-native';
import { router, type Href } from 'expo-router';

import { useTheme } from '@/design';
import { useT } from '@/i18n';

export type AuthMode = 'login' | 'signup' | 'join';

const HREF: Record<AuthMode, Href> = {
  login: '/(auth)/login',
  signup: '/(auth)/signup',
  join: '/join',
};

export function AuthModeToggle({
  value,
  onBeforeChange,
}: {
  value: AuthMode;
  onBeforeChange?: () => void | Promise<void>;
}) {
  const t = useT();
  const theme = useTheme();
  const items: { key: AuthMode; label: string }[] = [
    { key: 'login', label: t().auth.loginAction },
    { key: 'signup', label: t().auth.modeRegister },
    { key: 'join', label: t().auth.modeJoin },
  ];

  return (
    <View
      accessibilityRole="tablist"
      style={{
        flexDirection: 'row',
        backgroundColor: theme.colors.sand,
        borderRadius: theme.radii.pill,
        padding: 4,
        borderWidth: 0.5,
        borderColor: theme.colors.border,
      }}
    >
      {items.map((item) => {
        const selected = item.key === value;
        return (
          <Pressable
            key={item.key}
            accessibilityRole="tab"
            accessibilityState={{ selected }}
            onPress={() => {
              if (selected) return;
              void (async () => {
                await onBeforeChange?.();
                router.replace(HREF[item.key]);
              })();
            }}
            style={{
              flex: 1,
              minHeight: 40,
              borderRadius: theme.radii.pill,
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: selected ? theme.colors.primary : 'transparent',
            }}
          >
            <Text
              numberOfLines={1}
              style={{
                fontFamily: theme.fonts.bodyBold,
                fontSize: theme.typography.caption.fontSize,
                color: selected ? theme.colors.onPrimary : theme.colors.inkMuted,
              }}
              allowFontScaling
            >
              {item.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}
