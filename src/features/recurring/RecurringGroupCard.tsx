import Ionicons from '@expo/vector-icons/Ionicons';
import { Pressable, Text, View } from 'react-native';

import { useTheme } from '@/design';
import { t } from '@/i18n';

import type { RecurringTaskState } from './api';
import { RecurringTaskRow } from './RecurringTaskRow';

/** One template's recurring tasks for a period, with tick-off in place. */
export function RecurringGroupCard({
  title,
  tasks,
  doneCount,
  onOpenTemplate,
  onToggle,
}: {
  title: string;
  tasks: RecurringTaskState[];
  doneCount: number;
  onOpenTemplate?: () => void;
  onToggle: (task: RecurringTaskState) => void;
}) {
  const theme = useTheme();
  const copy = t().recurring;
  const allDone = tasks.length > 0 && doneCount === tasks.length;

  return (
    <View style={{ gap: theme.space.sm }}>
      <Pressable
        accessibilityRole={onOpenTemplate ? 'button' : undefined}
        disabled={!onOpenTemplate}
        onPress={onOpenTemplate}
        hitSlop={6}
        style={{ flexDirection: 'row', alignItems: 'center', gap: theme.space.sm }}
      >
        <Text
          style={{
            flex: 1,
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
            fontFamily: theme.fonts.bodyMedium,
            fontSize: theme.typography.caption.fontSize,
            color: allDone ? theme.colors.primary : theme.colors.inkMuted,
          }}
          allowFontScaling
        >
          {allDone
            ? copy.allDone
            : copy.progress
                .replace('{done}', String(doneCount))
                .replace('{total}', String(tasks.length))}
        </Text>
        {onOpenTemplate ? (
          <Ionicons name="chevron-forward" size={16} color={theme.colors.inkSubtle} />
        ) : null}
      </Pressable>
      {tasks.map((task) => (
        <RecurringTaskRow
          key={task.itemId}
          title={task.title}
          caption={task.sectionTitle}
          done={task.done}
          onToggle={() => onToggle(task)}
        />
      ))}
    </View>
  );
}
