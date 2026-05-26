"use server";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";

async function getUserId() {
  const session = await auth();
  if (!session?.user?.id) {
    throw new Error("Unauthorized");
  }
  return session.user.id;
}

// Create a task
export async function createTask(formData: FormData) {
  try {
    const userId = await getUserId();
    const title = formData.get("title") as string;
    const description = formData.get("description") as string;
    const dueDateStr = formData.get("dueDate") as string;
    const priority = (formData.get("priority") as string) || "MEDIUM";
    const category = (formData.get("category") as string) || "Work";
    const isRecurring = formData.get("isRecurring") === "true";
    const recurringDays = formData.getAll("recurringDays") as string[];

    if (!title) return { error: "Title is required" };

    const dueDate = dueDateStr ? new Date(dueDateStr) : null;

    // Get maximum order to place at bottom
    const maxOrderTask = await prisma.task.findFirst({
      where: { userId },
      orderBy: { order: "desc" },
    });
    const order = maxOrderTask ? maxOrderTask.order + 1 : 0;

    const task = await prisma.task.create({
      data: {
        userId,
        title,
        description,
        dueDate,
        priority,
        category,
        status: "PENDING",
        isRecurring,
        recurringDays,
        order,
      },
    });

    // Create automated due system notification
    await prisma.notification.create({
      data: {
        userId,
        message: `🆕 Task created: "${title}"`,
      },
    });

    revalidatePath("/");
    revalidatePath("/tasks");
    return { success: true, task };
  } catch (error: any) {
    return { error: error.message || "Failed to create task" };
  }
}

// Toggle Task completion status
export async function toggleTaskStatus(id: string, currentStatus: string) {
  try {
    const userId = await getUserId();
    const nextStatus = currentStatus === "DONE" ? "PENDING" : "DONE";

    const task = await prisma.task.findUnique({
      where: { id },
    });

    if (!task || task.userId !== userId) {
      return { error: "Task not found" };
    }

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

    revalidatePath("/");
    revalidatePath("/tasks");
    return { success: true };
  } catch (error: any) {
    return { error: error.message || "Failed to toggle task" };
  }
}

// Update task details
export async function updateTask(id: string, data: any) {
  try {
    const userId = await getUserId();

    const task = await prisma.task.findUnique({
      where: { id },
    });

    if (!task || task.userId !== userId) {
      return { error: "Task not found" };
    }

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
      },
    });

    revalidatePath("/");
    revalidatePath("/tasks");
    return { success: true, task: updatedTask };
  } catch (error: any) {
    return { error: error.message || "Failed to update task" };
  }
}

// Delete task
export async function deleteTask(id: string) {
  try {
    const userId = await getUserId();

    const task = await prisma.task.findUnique({
      where: { id },
    });

    if (!task || task.userId !== userId) {
      return { error: "Task not found" };
    }

    await prisma.task.delete({
      where: { id },
    });

    revalidatePath("/");
    revalidatePath("/tasks");
    return { success: true };
  } catch (error: any) {
    return { error: error.message || "Failed to delete task" };
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
  } catch (error: any) {
    return { error: error.message || "Failed to reorder tasks" };
  }
}
