"use server";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import type { TaskInput } from "@/lib/task-types";
import {
  createTaskRecord,
  recalculateGoalProgress,
  serializeTask,
  taskInclude,
  validateTaskLinks,
} from "@/lib/task-service";

async function getUserId() {
  const session = await auth();
  if (!session?.user?.id) {
    throw new Error("Unauthorized");
  }
  return session.user.id;
}

function errorMessage(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback;
}

function formDataToInput(formData: FormData): TaskInput {
  return {
    title: String(formData.get("title") || ""),
    description: String(formData.get("description") || ""),
    dueDate: String(formData.get("dueDate") || ""),
    priority: String(formData.get("priority") || "MEDIUM"),
    category: String(formData.get("category") || "Work"),
    isRecurring: formData.get("isRecurring") === "true",
    recurringDays: formData.getAll("recurringDays").map(String),
    groupId: String(formData.get("groupId") || "") || null,
    addToTodayGroup: formData.get("addToTodayGroup") === "true",
    goalId: String(formData.get("goalId") || "") || null,
    subGoalId: String(formData.get("subGoalId") || "") || null,
  };
}

export async function createTask(payload: FormData | TaskInput) {
  try {
    const userId = await getUserId();
    const input = payload instanceof FormData ? formDataToInput(payload) : payload;
    const task = await createTaskRecord(userId, input);

    await prisma.notification.create({
      data: {
        userId,
        message: `🆕 Task created: "${task.title}"`,
      },
    });

    revalidatePath("/");
    revalidatePath("/tasks");
    revalidatePath("/goals");
    return { success: true, task: serializeTask(task) };
  } catch (error: unknown) {
    return { error: errorMessage(error, "Failed to create task") };
  }
}

export async function createTaskGroup(title: string) {
  try {
    const userId = await getUserId();
    const groupTitle = title.trim();
    if (!groupTitle) return { error: "Group title is required" };
    const groupDate = new Date();
    groupDate.setHours(0, 0, 0, 0);
    const group = await prisma.taskGroup.create({
      data: { userId, title: groupTitle, groupDate },
    });
    revalidatePath("/tasks");
    return {
      success: true,
      group: { id: group.id, title: group.title, groupDate: group.groupDate.toISOString() },
    };
  } catch (error: unknown) {
    return { error: errorMessage(error, "Failed to create task group") };
  }
}

export async function updateTaskGroup(
  groupId: string,
  title: string,
  tasks: Array<{ id: string; title: string; priority: string }>
) {
  try {
    const userId = await getUserId();
    const group = await prisma.taskGroup.findFirst({ where: { id: groupId, userId }, select: { id: true } });
    if (!group) return { error: "Task group not found" };
    if (!title.trim()) return { error: "Group title is required" };
    if (tasks.some((task) => !task.title.trim())) return { error: "Every task needs a title" };

    await prisma.$transaction([
      prisma.taskGroup.update({ where: { id: groupId }, data: { title: title.trim() } }),
      ...tasks.map((task) =>
        prisma.task.updateMany({
          where: { id: task.id, userId, groupId },
          data: { title: task.title.trim(), priority: task.priority },
        })
      ),
    ]);
    revalidatePath("/tasks");
    return { success: true };
  } catch (error: unknown) {
    return { error: errorMessage(error, "Failed to update task group") };
  }
}

export async function deleteTaskGroup(groupId: string) {
  try {
    const userId = await getUserId();
    const group = await prisma.taskGroup.findFirst({ where: { id: groupId, userId }, select: { id: true } });
    if (!group) return { error: "Task group not found" };

    await prisma.$transaction([
      prisma.task.deleteMany({ where: { userId, groupId } }),
      prisma.taskGroup.delete({ where: { id: groupId } }),
    ]);
    await recalculateGoalProgress(userId);
    revalidatePath("/");
    revalidatePath("/tasks");
    revalidatePath("/goals");
    return { success: true };
  } catch (error: unknown) {
    return { error: errorMessage(error, "Failed to delete task group") };
  }
}

// Toggle Task completion status
export async function toggleTaskStatus(id: string, _currentStatus?: string) {
  void _currentStatus;
  try {
    const userId = await getUserId();
    const task = await prisma.task.findFirst({ where: { id, userId } });

    if (!task) {
      return { error: "Task not found" };
    }
    const nextStatus = task.status === "DONE" ? "PENDING" : "DONE";

    await prisma.task.update({
      where: { id },
      data: { status: nextStatus },
    });

    if (nextStatus === "DONE") {
      await prisma.notification.create({
        data: {
          userId,
          message: `✅ Completed task: "${task.title}"!`,
        },
      });
    }

    await recalculateGoalProgress(userId);
    revalidatePath("/");
    revalidatePath("/tasks");
    revalidatePath("/goals");
    return { success: true };
  } catch (error: unknown) {
    return { error: errorMessage(error, "Failed to toggle task") };
  }
}

// Update task details
export async function updateTask(id: string, data: TaskInput & { status?: string }) {
  try {
    const userId = await getUserId();

    const task = await prisma.task.findFirst({ where: { id, userId } });

    if (!task) {
      return { error: "Task not found" };
    }
    const links = await validateTaskLinks(userId, data);

    const updatedTask = await prisma.task.update({
      where: { id },
      data: {
        title: data.title,
        description: data.description,
        dueDate: data.dueDate ? new Date(data.dueDate) : null,
        priority: data.priority,
        category: data.category,
        status: data.status,
        isRecurring: data.isRecurring,
        recurringDays: data.recurringDays || [],
        ...links,
      },
      include: taskInclude,
    });

    await recalculateGoalProgress(userId);
    revalidatePath("/");
    revalidatePath("/tasks");
    revalidatePath("/goals");
    return { success: true, task: serializeTask(updatedTask) };
  } catch (error: unknown) {
    return { error: errorMessage(error, "Failed to update task") };
  }
}

// Delete task
export async function deleteTask(id: string) {
  try {
    const userId = await getUserId();

    const task = await prisma.task.findFirst({ where: { id, userId } });

    if (!task) {
      return { error: "Task not found" };
    }

    await prisma.task.delete({
      where: { id },
    });

    await recalculateGoalProgress(userId);
    revalidatePath("/");
    revalidatePath("/tasks");
    revalidatePath("/goals");
    return { success: true };
  } catch (error: unknown) {
    return { error: errorMessage(error, "Failed to delete task") };
  }
}

// Reorder tasks (Drag and Drop backend)
export async function reorderTasks(orderedIds: string[]) {
  try {
    const userId = await getUserId();

    // Perform updates in transaction or iterative updates
    const updates = orderedIds.map((id, index) =>
      prisma.task.updateMany({
        where: { id, userId },
        data: { order: index },
      })
    );

    await prisma.$transaction(updates);

    revalidatePath("/tasks");
    return { success: true };
  } catch (error: unknown) {
    return { error: errorMessage(error, "Failed to reorder tasks") };
  }
}
