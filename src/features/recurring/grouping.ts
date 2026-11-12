import type { TaskFrequency } from './period';

type GroupableTask = {
  templateId: string;
  templateTitle: string;
  frequency: TaskFrequency;
  done: boolean;
};

export type TemplateTaskGroup<T extends GroupableTask> = {
  templateId: string;
  templateTitle: string;
  tasks: T[];
  doneCount: number;
};

/** Open tasks first; done and blocked stay in their original order at the bottom. */
export function openTasksFirst<T extends { done: boolean }>(tasks: T[]): T[] {
  const open: T[] = [];
  const closed: T[] = [];
  for (const task of tasks) (task.done ? closed : open).push(task);
  return open.concat(closed);
}

/** Split tasks by frequency, then by template, keeping the incoming order. */
export function groupByFrequencyAndTemplate<T extends GroupableTask>(
  tasks: T[],
): Record<TaskFrequency, TemplateTaskGroup<T>[]> {
  const result: Record<TaskFrequency, TemplateTaskGroup<T>[]> = {
    daily: [],
    weekly: [],
    monthly: [],
    once: [],
  };
  for (const task of tasks) {
    const groups = result[task.frequency];
    let group = groups.find((g) => g.templateId === task.templateId);
    if (!group) {
      group = {
        templateId: task.templateId,
        templateTitle: task.templateTitle,
        tasks: [],
        doneCount: 0,
      };
      groups.push(group);
    }
    group.tasks.push(task);
    if (task.done) group.doneCount += 1;
  }
  for (const groups of Object.values(result)) {
    for (const group of groups) group.tasks = openTasksFirst(group.tasks);
  }
  return result;
}

export function countDone(tasks: { done: boolean }[]): number {
  return tasks.reduce((n, t) => n + (t.done ? 1 : 0), 0);
}
