import type { GoalOption, TaskGroupSummary, TaskView } from "@/lib/task-types";

export const queryKeys = {
  goals: {
    all: ["goals"] as const,
    list: (limit?: number) => ["goals", "list", limit ?? "all"] as const,
    options: ["goals", "options"] as const,
    tasks: (goalId: string) => ["goals", "tasks", goalId] as const,
  },
  notes: {
    all: ["notes"] as const,
    preview: (limit = 1) => ["notes", "preview", limit] as const,
    detail: (id: string) => ["notes", "detail", id] as const,
  },
  tasks: {
    all: ["tasks"] as const,
    board: ["tasks", "board"] as const,
    filter: (filter: string) => ["tasks", "filter", filter] as const,
  },
  transactions: {
    all: ["transactions"] as const,
  },
};

export type GoalListItem = {
  id: string;
  title: string;
  period: string;
  progress: number;
  isCompleted: boolean;
  dueDate?: string | null;
  parentGoalId?: string | null;
};

export type NotePreview = {
  id: string;
  title?: string | null;
  preview: string;
  attachments: string[];
  updatedAt: string;
};

export type TasksBoardData = {
  tasks: TaskView[];
  groups: TaskGroupSummary[];
};

async function readJson<T>(response: Response): Promise<T> {
  if (!response.ok) throw new Error(`Request failed (${response.status})`);
  return response.json() as Promise<T>;
}

export type GoalOptionRow = {
  id: string;
  title: string;
  period: string;
  parentGoalId: string | null;
  dueDate?: string | null;
  progress?: number;
  isCompleted?: boolean;
};

export async function fetchGoalOptionRows(): Promise<GoalOptionRow[]> {
  const data = await readJson<{ goals: GoalOptionRow[] }>(await fetch("/api/goals?mode=options"));
  return Array.isArray(data.goals) ? data.goals : [];
}

export function toGoalOptions(items: GoalOptionRow[]): GoalOption[] {
  return items
    .filter((goal) => !goal.parentGoalId)
    .map((goal) => ({
      id: goal.id,
      title: goal.title,
      period: goal.period,
      parentGoalId: null,
      subGoals: items
        .filter((candidate) => candidate.parentGoalId === goal.id)
        .map(({ id, title, period, parentGoalId }) => ({ id, title, period, parentGoalId })),
    }));
}

export async function fetchGoalOptions(): Promise<GoalOption[]> {
  return toGoalOptions(await fetchGoalOptionRows());
}

export async function fetchGoalsList(limit = 6): Promise<GoalListItem[]> {
  const data = await readJson<{ goals: GoalListItem[] }>(
    await fetch(`/api/goals?mode=list&limit=${limit}`)
  );
  return Array.isArray(data.goals) ? data.goals : [];
}

export async function fetchNotesPreview(limit = 1): Promise<NotePreview[]> {
  const data = await readJson<{ notes: NotePreview[] }>(await fetch(`/api/notes?limit=${limit}`));
  return Array.isArray(data.notes) ? data.notes : [];
}

export async function fetchTasksBoard(): Promise<TasksBoardData> {
  const data = await readJson<{ tasks?: TaskView[]; groups?: TaskGroupSummary[] }>(
    await fetch("/api/tasks")
  );
  return {
    tasks: Array.isArray(data.tasks) ? data.tasks : [],
    groups: Array.isArray(data.groups) ? data.groups : [],
  };
}

export async function fetchTransactionsList() {
  const data = await readJson<{ transactions?: unknown[] }>(await fetch("/api/transactions"));
  return Array.isArray(data.transactions) ? data.transactions : [];
}
