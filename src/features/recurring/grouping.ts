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

/** Split tasks by frequency, then by template, keeping the incoming order. */
export function groupByFrequencyAndTemplate<T extends GroupableTask>(
  tasks: T[],
): Record<TaskFrequency, TemplateTaskGroup<T>[]> {
  const result: Record<TaskFrequency, TemplateTaskGroup<T>[]> = {
    daily: [],
    weekly: [],
    monthly: [],
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
  return result;
}

export function countDone(tasks: { done: boolean }[]): number {
  return tasks.reduce((n, t) => n + (t.done ? 1 : 0), 0);
}
