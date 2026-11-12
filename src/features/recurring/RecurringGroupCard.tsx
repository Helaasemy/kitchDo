import { useRef, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import * as Haptics from 'expo-haptics';

import { AssigneeAvatar } from '@/features/assignment';
import { useTheme } from '@/design';
import { useT } from '@/i18n';

import type { RecurringTaskState } from './api';
import type { TaskFrequency } from './period';
import { RecurringTaskRow } from './RecurringTaskRow';

/** Hold until haptic, then run the action after the finger lifts so a parent ScrollView cannot cancel navigation. */
function useHoldToEdit(onEdit?: () => void) {
  const held = useRef(false);
  if (!onEdit) return {};
  return {
    delayLongPress: 350,
    cancelable: false as const,
    onLongPress: () => {
      held.current = true;
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    },
    onPressOut: () => {
      if (!held.current) return;
      held.current = false;
      onEdit();
    },
  };
}

/** One template's recurring tasks for a period, as a paper card with tick-off in place. */
export function RecurringGroupCard({
  title,
  frequency,
  tasks,
  doneCount,
  onEditTemplate,
  onToggle,
  memberNames,
}: {
  title: string;
  frequency: TaskFrequency;
  tasks: RecurringTaskState[];
  doneCount: number;
  onEditTemplate?: () => void;
  onToggle: (task: RecurringTaskState) => void;
  memberNames?: Record<string, string>;
}) {
  const t = useT();
  const theme = useTheme();
  const copy = t().recurring;
  const accent = theme.colors.frequency[frequency];
  const allDone = tasks.length > 0 && doneCount === tasks.length;
  const [expanded, setExpanded] = useState(true);
  const hold = useHoldToEdit(onEditTemplate);

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
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          borderBottomWidth: expanded ? 0.5 : 0,
          borderBottomColor: theme.colors.border,
        }}
      >
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={title}
          accessibilityState={{ expanded }}
          accessibilityHint={hint}
          onPress={() => setExpanded((open) => !open)}
          {...hold}
          style={({ pressed }) => ({
            flex: 1,
            flexDirection: 'row',
            alignItems: 'center',
            gap: theme.space.sm,
            padding: theme.space.xl - 4,
            minHeight: 48,
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
        {onEditTemplate ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={copy.editA11y}
            onPress={onEditTemplate}
            hitSlop={8}
            style={({ pressed }) => ({
              width: 44,
              height: 48,
              alignItems: 'center',
              justifyContent: 'center',
              paddingRight: theme.space.md,
              opacity: pressed ? 0.7 : 1,
            })}
          >
            <Ionicons name="create-outline" size={18} color={theme.colors.inkMuted} />
          </Pressable>
        ) : null}
      </View>
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
              {...hold}
              trailing={
                task.assigneeUserId ? (
                  <AssigneeAvatar
                    size={28}
                    userId={task.assigneeUserId}
                    name={memberNames?.[task.assigneeUserId] ?? ''}
                  />
                ) : undefined
              }
            />
          ))
        : null}
    </View>
  );
}
