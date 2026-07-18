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
  await recalculateGoalProgress(userId);
  return task;
}

function collectDescendants(goalId: string, children: Map<string, string[]>) {
  const ids = [goalId];
  for (const childId of children.get(goalId) || []) ids.push(...collectDescendants(childId, children));
  return ids;
}

export async function recalculateGoalProgress(userId: string) {
  const goals = await prisma.goal.findMany({
    where: { userId },
    select: { id: true, parentGoalId: true },
  });
  const children = new Map<string, string[]>();
  for (const goal of goals) {
    if (!goal.parentGoalId) continue;
    children.set(goal.parentGoalId, [...(children.get(goal.parentGoalId) || []), goal.id]);
  }

  for (const goal of goals) {
    const ids = collectDescendants(goal.id, children);
    const tasks = await prisma.task.findMany({
      where: { userId, OR: [{ goalId: { in: ids } }, { subGoalId: { in: ids } }] },
      select: { id: true, status: true },
    });
    const unique = new Map(tasks.map((task) => [task.id, task]));
    const completed = Array.from(unique.values()).filter((task) => task.status === "DONE").length;
    const progress = unique.size === 0 ? 0 : Math.round((completed / unique.size) * 100);
    await prisma.goal.update({
      where: { id: goal.id },
      data: { progress, isCompleted: unique.size > 0 && completed === unique.size },
    });
  }
}
