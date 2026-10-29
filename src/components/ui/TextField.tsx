import { useState } from 'react';
import {
  Text,
  TextInput,
  View,
  type TextInputProps,
  type StyleProp,
  type ViewStyle,
} from 'react-native';

import { useTheme } from '@/design';

type Props = Omit<TextInputProps, 'style'> & {
  label: string;
  error?: string | null;
  containerStyle?: StyleProp<ViewStyle>;
};

export function TextField({
  label,
  error,
  containerStyle,
  onFocus,
  onBlur,
  multiline,
  ...rest
}: Props) {
  const theme = useTheme();
  const [focused, setFocused] = useState(false);

  return (
    <View style={[{ gap: theme.space.xs, width: '100%' }, containerStyle]}>
      <Text
        style={{
          fontFamily: theme.fonts.label,
          fontSize: theme.typography.label.fontSize,
          lineHeight: theme.typography.label.lineHeight,
          color: theme.colors.inkSubtle,
          textTransform: 'uppercase',
          letterSpacing: 0.6,
        }}
        allowFontScaling
      >
        {label}
      </Text>
      <TextInput
        {...rest}
        multiline={multiline}
        allowFontScaling
        placeholderTextColor={theme.colors.inkSubtle}
        onFocus={(e) => {
          setFocused(true);
          onFocus?.(e);
        }}
        onBlur={(e) => {
          setFocused(false);
          onBlur?.(e);
        }}
        style={{
          width: '100%',
          minHeight: multiline ? 96 : 48,
          paddingHorizontal: theme.space.md,
          paddingTop: multiline ? theme.space.md : 0,
          paddingBottom: multiline ? theme.space.md : 0,
          borderRadius: theme.radii.sm,
          borderWidth: 1,
          borderColor: error
            ? theme.colors.coral
            : focused
              ? theme.colors.primary
              : theme.colors.border,
          backgroundColor: theme.colors.white,
          fontFamily: theme.fonts.body,
          fontSize: theme.typography.body.fontSize,
          // Single-line: no lineHeight — flex/padding centers text vertically.
          ...(multiline
            ? { lineHeight: theme.typography.body.lineHeight, textAlignVertical: 'top' as const }
            : { textAlignVertical: 'center' as const }),
          color: theme.colors.ink,
          includeFontPadding: false,
        }}
      />
      {error ? (
        <Text
          style={{
            fontFamily: theme.fonts.body,
            fontSize: theme.typography.caption.fontSize,
            lineHeight: theme.typography.caption.lineHeight,
            color: theme.colors.coral,
          }}
          allowFontScaling
        >
          {error}
        </Text>
      ) : null}
    </View>
  );
}
