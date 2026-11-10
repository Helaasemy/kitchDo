import { useState, type ComponentRef, type ReactNode, type Ref } from 'react';
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
  /** Trailing control drawn inside the input (e.g. a show/hide toggle). */
  right?: ReactNode;
  ref?: Ref<ComponentRef<typeof TextInput>>;
};

export function TextField({
  label,
  error,
  containerStyle,
  onFocus,
  onBlur,
  multiline,
  right,
  ref,
  ...rest
}: Props) {
  const theme = useTheme();
  const [focused, setFocused] = useState(false);

  return (
    <View style={[{ gap: theme.space.xs, width: '100%' }, containerStyle]}>
      <Text
        style={{
          fontFamily: theme.fonts.label,
          fontSize: theme.typography.chip.fontSize,
          lineHeight: theme.typography.chip.lineHeight,
          color: theme.colors.inkMuted,
          textTransform: 'uppercase',
          letterSpacing: 0.9,
          paddingLeft: theme.space.xs,
        }}
        allowFontScaling
      >
        {label}
      </Text>
      <View style={{ justifyContent: 'center' }}>
        <TextInput
          {...rest}
          ref={ref}
          accessibilityLabel={rest.accessibilityLabel ?? label}
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
            minHeight: multiline ? 96 : 52,
            paddingLeft: theme.space.lg,
            paddingRight: right ? 52 : theme.space.lg,
            paddingTop: multiline ? theme.space.md : 0,
            paddingBottom: multiline ? theme.space.md : 0,
            borderRadius: theme.radii.xl,
            borderWidth: focused || error ? 1.5 : 1,
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
              ? {
                  lineHeight: theme.typography.body.lineHeight,
                  textAlignVertical: 'top' as const,
                }
              : { textAlignVertical: 'center' as const }),
            color: theme.colors.ink,
            includeFontPadding: false,
          }}
        />
        {right ? (
          <View
            style={{
              position: 'absolute',
              right: 4,
              top: 0,
              bottom: 0,
              justifyContent: 'center',
            }}
          >
            {right}
          </View>
        ) : null}
      </View>
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
