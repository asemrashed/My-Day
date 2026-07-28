import { prisma } from "@/lib/prisma";
import type { TaskInput } from "@/lib/task-types";
import type { Prisma } from "@prisma/client";

export const taskInclude = {
  group: true,
  goal: { select: { id: true, title: true, period: true, parentGoalId: true } },
  subGoal: { select: { id: true, title: true, period: true, parentGoalId: true } },
} as const;

type TaskWithLinks = Prisma.TaskGetPayload<{ include: typeof taskInclude }>;

export function serializeTask(task: TaskWithLinks) {
  return {
    ...task,
    dueDate: task.dueDate ? task.dueDate.toISOString() : null,
    createdAt: undefined,
    legacyChecklistId: undefined,
    group: task.group
      ? { ...task.group, groupDate: task.group.groupDate.toISOString(), createdAt: undefined, userId: undefined }
      : null,
  };
}

function todayBounds() {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(end.getDate() + 1);
  return { start, end };
}

export async function getOrCreateTodayGroup(userId: string) {
  const { start, end } = todayBounds();
  const existing = await prisma.taskGroup.findFirst({
    where: { userId, groupDate: { gte: start, lt: end } },
    orderBy: { createdAt: "asc" },
  });
  if (existing) return existing;

  const title = `Today, ${start.toLocaleDateString("en-US", { month: "short", day: "numeric" })}`;
  return prisma.taskGroup.create({ data: { userId, title, groupDate: start } });
}

export async function validateTaskLinks(userId: string, input: TaskInput) {
  let groupId = input.groupId || null;
  if (input.addToTodayGroup) groupId = (await getOrCreateTodayGroup(userId)).id;
  if (groupId) {
    const group = await prisma.taskGroup.findFirst({ where: { id: groupId, userId }, select: { id: true } });
    if (!group) throw new Error("Task group not found");
  }

  const goalId = input.goalId || null;
  const subGoalId = input.subGoalId || null;
  if (subGoalId && !goalId) throw new Error("Choose a parent goal before choosing a sub-goal");
  if (goalId) {
    const goal = await prisma.goal.findFirst({ where: { id: goalId, userId }, select: { id: true } });
    if (!goal) throw new Error("Goal not found");
  }
  if (subGoalId) {
    const subGoal = await prisma.goal.findFirst({
      where: { id: subGoalId, userId, parentGoalId: goalId },
      select: { id: true },
    });
    if (!subGoal) throw new Error("Sub-goal does not belong to the selected goal");
  }
  return { groupId, goalId, subGoalId };
}

export async function createTaskRecord(userId: string, input: TaskInput) {
  const title = input.title?.trim();
  if (!title) throw new Error("Title is required");
  const links = await validateTaskLinks(userId, input);
  const maxOrderTask = await prisma.task.findFirst({ where: { userId }, orderBy: { order: "desc" } });

  const task = await prisma.task.create({
    data: {
      userId,
      title,
      description: input.description?.trim() || null,
      dueDate: input.dueDate ? new Date(input.dueDate) : null,
      priority: input.priority || "MEDIUM",
      category: input.category || "Work",
      status: "PENDING",
      isRecurring: input.isRecurring || false,
      recurringDays: input.recurringDays || [],
      order: maxOrderTask ? maxOrderTask.order + 1 : 0,
      ...links,
    },
    include: taskInclude,
  });
  await recalculateGoalProgress(userId, { seedGoalIds: [links.goalId, links.subGoalId] });
  return task;
}

export type GoalProgressUpdate = {
  id: string;
  progress: number;
  isCompleted: boolean;
};

export type RecalculateGoalProgressOptions = {
  /** Goal IDs touched by a mutation; ancestors are included automatically. */
  seedGoalIds?: Array<string | null | undefined>;
  /** Recalculate every goal for the user (hierarchy moves / bulk deletes). */
  all?: boolean;
};

function collectDescendants(goalId: string, children: Map<string, string[]>) {
  const ids = [goalId];
  for (const childId of children.get(goalId) || []) ids.push(...collectDescendants(childId, children));
  return ids;
}

function collectAncestors(goalId: string, parentById: Map<string, string | null>) {
  const ids: string[] = [];
  let current: string | null | undefined = goalId;
  const seen = new Set<string>();
  while (current && !seen.has(current)) {
    seen.add(current);
    ids.push(current);
    current = parentById.get(current) ?? null;
  }
  return ids;
}

/**
 * Recalculates stored goal progress. Prefer seeding affected goal IDs so only
 * that branch is rewritten (batched: 2 reads + 1 transaction of updates).
 */
export async function recalculateGoalProgress(
  userId: string,
  options: RecalculateGoalProgressOptions = {}
): Promise<GoalProgressUpdate[]> {
  const seeds = Array.from(
    new Set((options.seedGoalIds || []).filter((id): id is string => Boolean(id)))
  );
  if (!options.all && seeds.length === 0) return [];

  const goals = await prisma.goal.findMany({
    where: { userId },
    select: { id: true, parentGoalId: true, progress: true, isCompleted: true },
  });
  if (goals.length === 0) return [];

  const children = new Map<string, string[]>();
  const parentById = new Map<string, string | null>();
  for (const goal of goals) {
    parentById.set(goal.id, goal.parentGoalId);
    if (!goal.parentGoalId) continue;
    children.set(goal.parentGoalId, [...(children.get(goal.parentGoalId) || []), goal.id]);
  }

  const affectedIds = new Set<string>();
  if (options.all) {
    for (const goal of goals) affectedIds.add(goal.id);
  } else {
    for (const seed of seeds) {
      if (!parentById.has(seed)) continue;
      for (const id of collectAncestors(seed, parentById)) affectedIds.add(id);
    }
  }
  if (affectedIds.size === 0) return [];

  const descendantIds = new Set<string>();
  Array.from(affectedIds).forEach((goalId) => {
    for (const id of collectDescendants(goalId, children)) descendantIds.add(id);
  });
  const scope = Array.from(descendantIds);

  const tasks = await prisma.task.findMany({
    where: { userId, OR: [{ goalId: { in: scope } }, { subGoalId: { in: scope } }] },
    select: { id: true, status: true, goalId: true, subGoalId: true },
  });

  const results: GoalProgressUpdate[] = [];
  const writes: GoalProgressUpdate[] = [];
  Array.from(affectedIds).forEach((goalId) => {
    const ids = new Set(collectDescendants(goalId, children));
    const unique = new Map<string, { id: string; status: string }>();
    for (const task of tasks) {
      if ((task.goalId && ids.has(task.goalId)) || (task.subGoalId && ids.has(task.subGoalId))) {
        unique.set(task.id, task);
      }
    }
    const completed = Array.from(unique.values()).filter((task) => task.status === "DONE").length;
    const progress = unique.size === 0 ? 0 : Math.round((completed / unique.size) * 100);
    const isCompleted = unique.size > 0 && completed === unique.size;
    const update = { id: goalId, progress, isCompleted };
    results.push(update);
    const previous = goals.find((goal) => goal.id === goalId);
    if (!previous || previous.progress !== progress || previous.isCompleted !== isCompleted) {
      writes.push(update);
    }
  });

  if (writes.length > 0) {
    await prisma.$transaction(
      writes.map((update) =>
        prisma.goal.update({
          where: { id: update.id },
          data: { progress: update.progress, isCompleted: update.isCompleted },
        })
      )
    );
  }

  return results;
}
