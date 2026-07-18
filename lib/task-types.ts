export const TASK_CATEGORIES = ["Work", "Personal", "Learning", "Health", "Shopping", "Goal", "Other"];
export const TASK_PRIORITIES = ["HIGH", "MEDIUM", "LOW"] as const;

export type TaskGoalSummary = {
  id: string;
  title: string;
  period: string;
  parentGoalId: string | null;
};

export type TaskGroupSummary = {
  id: string;
  title: string;
  groupDate: string;
};

export type TaskView = {
  id: string;
  title: string;
  description: string | null;
  dueDate: string | null;
  priority: string;
  category: string;
  status: string;
  isRecurring: boolean;
  recurringDays: string[];
  order: number;
  groupId: string | null;
  goalId: string | null;
  subGoalId: string | null;
  group: TaskGroupSummary | null;
  goal: TaskGoalSummary | null;
  subGoal: TaskGoalSummary | null;
};

export type GoalOption = TaskGoalSummary & {
  subGoals: TaskGoalSummary[];
};

export type TaskInput = {
  title: string;
  description?: string | null;
  dueDate?: string | null;
  priority?: string;
  category?: string;
  isRecurring?: boolean;
  recurringDays?: string[];
  groupId?: string | null;
  addToTodayGroup?: boolean;
  goalId?: string | null;
  subGoalId?: string | null;
};
