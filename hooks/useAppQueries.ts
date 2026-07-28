"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  fetchGoalOptionRows,
  fetchGoalsList,
  fetchNotesPreview,
  fetchTasksBoard,
  fetchTransactionsList,
  queryKeys,
  toGoalOptions,
  type TasksBoardData,
} from "@/lib/queries";
import type { TaskGroupSummary, TaskView } from "@/lib/task-types";

export function useGoalOptions(enabled = true) {
  return useQuery({
    queryKey: queryKeys.goals.options,
    queryFn: fetchGoalOptionRows,
    enabled,
    select: toGoalOptions,
  });
}

export function useGoalOptionRows(enabled = true) {
  return useQuery({
    queryKey: queryKeys.goals.options,
    queryFn: fetchGoalOptionRows,
    enabled,
  });
}

export function useGoalsPreview(limit = 3) {
  return useQuery({
    queryKey: queryKeys.goals.list(limit),
    queryFn: () => fetchGoalsList(limit),
  });
}

export function useNotesPreview(limit = 1) {
  return useQuery({
    queryKey: queryKeys.notes.preview(limit),
    queryFn: () => fetchNotesPreview(limit),
  });
}

export function useTasksBoard(
  initial?: { tasks: TaskView[]; groups: TaskGroupSummary[] },
  enabled = true
) {
  return useQuery({
    queryKey: queryKeys.tasks.board,
    queryFn: fetchTasksBoard,
    enabled,
    initialData: initial
      ? ({ tasks: initial.tasks, groups: initial.groups } satisfies TasksBoardData)
      : undefined,
    initialDataUpdatedAt: initial ? Date.now() : undefined,
  });
}

export function useTransactionsList(enabled = true) {
  return useQuery({
    queryKey: queryKeys.transactions.all,
    queryFn: fetchTransactionsList,
    enabled,
  });
}

/** Invalidate shared caches after mutations (keeps A–D page logic intact). */
export function useInvalidateAppQueries() {
  const queryClient = useQueryClient();
  return {
    invalidateGoals: () => queryClient.invalidateQueries({ queryKey: queryKeys.goals.all }),
    invalidateNotes: () => queryClient.invalidateQueries({ queryKey: queryKeys.notes.all }),
    invalidateTasks: () => queryClient.invalidateQueries({ queryKey: queryKeys.tasks.all }),
    invalidateTransactions: () => queryClient.invalidateQueries({ queryKey: queryKeys.transactions.all }),
  };
}
