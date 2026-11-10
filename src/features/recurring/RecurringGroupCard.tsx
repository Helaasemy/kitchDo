import Ionicons from '@expo/vector-icons/Ionicons';
import { Pressable, Text, View } from 'react-native';

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
  onOpenTemplate,
  onToggle,
}: {
  title: string;
  frequency: TaskFrequency;
  tasks: RecurringTaskState[];
  doneCount: number;
  onOpenTemplate?: () => void;
  onToggle: (task: RecurringTaskState) => void;
}) {
  const t = useT();
  const theme = useTheme();
  const copy = t().recurring;
  const accent = theme.colors.frequency[frequency];
  const allDone = tasks.length > 0 && doneCount === tasks.length;

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
        accessibilityRole={onOpenTemplate ? 'button' : undefined}
        disabled={!onOpenTemplate}
        onPress={onOpenTemplate}
        style={({ pressed }) => ({
          flexDirection: 'row',
          alignItems: 'center',
          gap: theme.space.sm,
          padding: theme.space.xl - 4,
          borderBottomWidth: 0.5,
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
        ) : onOpenTemplate ? (
          <Ionicons name="chevron-forward" size={14} color={theme.colors.inkSubtle} />
        ) : null}
      </Pressable>
      {tasks.map((task, index) => (
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
      ))}
    </View>
  );
}
