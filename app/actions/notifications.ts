"use server";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";

// Utility to get current authenticated user ID
async function getUserId() {
  const session = await auth();
  if (!session?.user?.id) {
    throw new Error("Unauthorized");
  }
  return session.user.id;
}

// Fetch all notifications for the current user
export async function getNotifications() {
  try {
    const userId = await getUserId();
    const notifications = await prisma.notification.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
    });
    return { notifications };
  } catch (error: any) {
    return { error: error.message || "Failed to fetch notifications" };
  }
}

// Create a new notification (server-side helper)
export async function createNotification(message: string, userIdInput?: string) {
  try {
    let targetUserId = userIdInput;
    if (!targetUserId) {
      const session = await auth();
      targetUserId = session?.user?.id;
    }
    
    if (!targetUserId) return { error: "No user specified" };

    const notification = await prisma.notification.create({
      data: {
        userId: targetUserId,
        message,
        isRead: false,
      },
    });

    revalidatePath("/");
    return { success: true, notification };
  } catch (error: any) {
    return { error: error.message || "Failed to create notification" };
  }
}

// Mark a specific notification as read
export async function markAsRead(id: string) {
  try {
    const userId = await getUserId();
    
    // Verify notification ownership
    const notification = await prisma.notification.findUnique({
      where: { id },
    });

    if (!notification || notification.userId !== userId) {
      return { error: "Notification not found" };
    }

    await prisma.notification.update({
      where: { id },
      data: { isRead: true },
    });

    revalidatePath("/");
    return { success: true };
  } catch (error: any) {
    return { error: error.message || "Failed to mark notification as read" };
  }
}

// Mark all notifications as read
export async function markAllAsRead() {
  try {
    const userId = await getUserId();

    await prisma.notification.updateMany({
      where: { userId, isRead: false },
      data: { isRead: true },
    });

    revalidatePath("/");
    return { success: true };
  } catch (error: any) {
    return { error: error.message || "Failed to mark all notifications as read" };
  }
}

// Delete a notification
export async function deleteNotification(id: string) {
  try {
    const userId = await getUserId();

    const notification = await prisma.notification.findUnique({
      where: { id },
    });

    if (!notification || notification.userId !== userId) {
      return { error: "Notification not found" };
    }

    await prisma.notification.delete({
      where: { id },
    });

    revalidatePath("/");
    return { success: true };
  } catch (error: any) {
    return { error: error.message || "Failed to delete notification" };
  }
}
