import { Text, View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';

import { useTheme } from '@/design';
import type { DueUrgency } from '@/lib/dates';

type Props = {
  shortLabel: string;
  progress: number;
  urgency: DueUrgency;
  size?: number;
};

/** Small circular countdown loader with remaining time in the center. */
export function DueCountdownRing({
  shortLabel,
  progress,
  urgency,
  size = 48,
}: Props) {
  const theme = useTheme();
  const stroke = 4;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const clamped = Math.min(1, Math.max(0, progress));
  const offset = circumference * (1 - clamped);

  const color =
    urgency === 'overdue'
      ? theme.colors.coral
      : urgency === 'soon'
        ? theme.colors.primary
        : theme.colors.primaryMuted;

  const track =
    urgency === 'overdue'
      ? 'rgba(225, 29, 72, 0.2)'
      : 'rgba(15, 118, 110, 0.18)';

  const label =
    urgency === 'overdue' ? `+${shortLabel}` : shortLabel;

  return (
    <View
      accessibilityRole="text"
      accessibilityLabel={label}
      style={{
        width: size,
        height: size,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <Svg
        width={size}
        height={size}
        style={{ position: 'absolute', left: 0, top: 0 }}
      >
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={track}
          strokeWidth={stroke}
          fill={theme.colors.white}
        />
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={color}
          strokeWidth={stroke}
          fill="none"
          strokeDasharray={`${circumference} ${circumference}`}
          strokeDashoffset={urgency === 'overdue' ? 0 : offset}
          strokeLinecap="round"
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
      </Svg>
      <Text
        style={{
          fontFamily: theme.fonts.label,
          fontSize: label.length > 4 ? 9 : 11,
          lineHeight: 13,
          color,
          textAlign: 'center',
          zIndex: 1,
        }}
        numberOfLines={1}
        allowFontScaling={false}
      >
        {label}
      </Text>
    </View>
  );
}
