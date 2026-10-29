import { Text, View } from 'react-native';

import { useTheme } from '@/design';
import { Button } from './Button';

type Props = {
  title: string;
  body: string;
  actionLabel?: string;
  onAction?: () => void;
};

/**
 * Empty list state — shares Screen left edge (no extra inset), sits under the
 * header instead of floating mid-viewport (UI/UX Pro Max layout consistency).
 */
export function EmptyState({ title, body, actionLabel, onAction }: Props) {
  const theme = useTheme();

  return (
    <View
      style={{
        width: '100%',
        alignItems: 'stretch',
        gap: theme.space.md,
        paddingTop: theme.space.md,
        paddingBottom: theme.space.xxl,
      }}
    >
      <Text
        style={{
          fontFamily: theme.fonts.display,
          fontSize: theme.typography.heading.fontSize,
          lineHeight: theme.typography.heading.lineHeight,
          color: theme.colors.ink,
        }}
        allowFontScaling
      >
        {title}
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
        {body}
      </Text>
      {actionLabel && onAction ? (
        <Button
          label={actionLabel}
          onPress={onAction}
          variant="secondary"
          style={{ alignSelf: 'stretch', marginTop: theme.space.xs }}
        />
      ) : null}
    </View>
  );
}
