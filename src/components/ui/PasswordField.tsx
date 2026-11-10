import { useState, type ComponentProps } from 'react';
import { Pressable, Text, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';

import { useTheme } from '@/design';
import { useT } from '@/i18n';

import { TextField } from './TextField';

type Props = Omit<ComponentProps<typeof TextField>, 'secureTextEntry' | 'right'>;

/** TextField with a show/hide toggle for the password. */
export function PasswordField(props: Props) {
  const t = useT();
  const theme = useTheme();
  const [visible, setVisible] = useState(false);
  const copy = t().auth;

  return (
    <TextField
      {...props}
      secureTextEntry={!visible}
      autoCapitalize="none"
      autoCorrect={false}
      right={
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={visible ? copy.hidePassword : copy.showPassword}
          onPress={() => setVisible((v) => !v)}
          hitSlop={4}
          style={{ width: 44, height: 44, alignItems: 'center', justifyContent: 'center' }}
        >
          <Ionicons
            name={visible ? 'eye-off-outline' : 'eye-outline'}
            size={20}
            color={theme.colors.inkMuted}
          />
        </Pressable>
      }
    />
  );
}

/** One password rule with a check that turns sage once met. */
export function RequirementRow({ label, met }: { label: string; met: boolean }) {
  const t = useT();
  const theme = useTheme();
  return (
    <View
      style={{ flexDirection: 'row', alignItems: 'center', gap: theme.space.sm }}
      accessible
      accessibilityLabel={`${label}${met ? `, ${t().auth.requirementMet}` : ''}`}
    >
      <Ionicons
        name={met ? 'checkmark-circle' : 'checkmark-circle-outline'}
        size={18}
        color={met ? theme.colors.frequency.monthly.text : theme.colors.inkSubtle}
      />
      <Text
        style={{
          fontFamily: theme.fonts.bodySemiBold,
          fontSize: theme.typography.caption.fontSize,
          lineHeight: theme.typography.caption.lineHeight,
          color: met ? theme.colors.frequency.monthly.text : theme.colors.inkMuted,
        }}
        allowFontScaling
      >
        {label}
      </Text>
    </View>
  );
}
