import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import * as Haptics from 'expo-haptics';

import { useTheme } from '@/design';
import { useT } from '@/i18n';

import type { RecurringTaskState } from './api';
import type { TaskFrequency } from './period';
import { RecurringTaskRow } from './RecurringTaskRow';

/** One template's recurring tasks for a period, as a paper card with tick-off in place. */
export function RecurringGroupCard({
  title,
  frequency,
  tasks,
  doneCount,
  onEditTemplate,
  onToggle,
}: {
  title: string;
  frequency: TaskFrequency;
  tasks: RecurringTaskState[];
  doneCount: number;
  onEditTemplate?: () => void;
  onToggle: (task: RecurringTaskState) => void;
}) {
  const t = useT();
  const theme = useTheme();
  const copy = t().recurring;
  const accent = theme.colors.frequency[frequency];
  const allDone = tasks.length > 0 && doneCount === tasks.length;
  const [expanded, setExpanded] = useState(true);

  const hint = [
    expanded ? copy.collapseA11y : copy.expandA11y,
    onEditTemplate ? copy.editHoldA11y : null,
  ]
    .filter(Boolean)
    .join('. ');

  return (
    <View
      style={{
        backgroundColor: theme.colors.card,
        borderRadius: theme.radii.xl,
        borderWidth: 0.5,
        borderColor: theme.colors.border,
        boxShadow: theme.shadows.soft,
        overflow: 'hidden',
      }}
    >
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={title}
        accessibilityState={{ expanded }}
        accessibilityHint={hint}
        onPress={() => setExpanded((open) => !open)}
        onLongPress={
          onEditTemplate
            ? () => {
                void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                requestAnimationFrame(() => onEditTemplate());
              }
            : undefined
        }
        delayLongPress={550}
        style={({ pressed }) => ({
          flexDirection: 'row',
          alignItems: 'center',
          gap: theme.space.sm,
          padding: theme.space.xl - 4,
          minHeight: 48,
          borderBottomWidth: expanded ? 0.5 : 0,
          borderBottomColor: theme.colors.border,
          backgroundColor: pressed ? theme.colors.sand : 'transparent',
        })}
      >
        <Text
          style={{
            flex: 1,
            fontFamily: theme.fonts.bodyExtraBold,
            fontSize: theme.typography.cardTitle.fontSize,
            lineHeight: theme.typography.cardTitle.lineHeight,
            color: theme.colors.ink,
          }}
          allowFontScaling
        >
          {title}
        </Text>
        <Text
          style={{
            fontFamily: theme.fonts.bodyExtraBold,
            fontSize: theme.typography.caption.fontSize,
            color: allDone ? accent.text : theme.colors.inkMuted,
          }}
          allowFontScaling
        >
          {allDone
            ? copy.allDone
            : copy.progressShort
                .replace('{done}', String(doneCount))
                .replace('{total}', String(tasks.length))}
        </Text>
        {allDone ? (
          <Ionicons name="checkmark-circle" size={18} color={accent.text} />
        ) : null}
        <Ionicons
          name={expanded ? 'chevron-down' : 'chevron-forward'}
          size={14}
          color={theme.colors.inkSubtle}
        />
      </Pressable>
      {expanded
        ? tasks.map((task, index) => (
            <RecurringTaskRow
              key={task.itemId}
              title={task.title}
              caption={task.sectionTitle}
              done={task.done}
              accent={accent}
              grouped
              divider={index < tasks.length - 1}
              onToggle={() => onToggle(task)}
            />
          ))
        : null}
    </View>
  );
}
