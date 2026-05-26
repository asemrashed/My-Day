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

// Create a new Transaction (Income or Expense)
export async function createTransaction(formData: FormData) {
  try {
    const userId = await getUserId();
    const type = formData.get("type") as string; // INCOME or EXPENSE
    const amountStr = formData.get("amount") as string;
    const category = formData.get("category") as string;
    const note = formData.get("note") as string;
    const dateStr = formData.get("date") as string;

    if (!type || !amountStr || !category) {
      return { error: "Type, amount, and category are required" };
    }

    const amount = parseFloat(amountStr);
    if (isNaN(amount) || amount <= 0) {
      return { error: "Amount must be a positive number" };
    }

    const date = dateStr ? new Date(dateStr) : new Date();

    const transaction = await prisma.transaction.create({
      data: {
        userId,
        type,
        amount,
        category,
        note,
        date,
      },
    });

    // Create a database notification
    const formattedAmount = `৳${amount.toLocaleString("en-US", { minimumFractionDigits: 2 })}`;
    const notificationMessage = type === "INCOME"
      ? `💰 Added income: +${formattedAmount} (${category})`
      : `💸 Added expense: -${formattedAmount} (${category})`;

    await prisma.notification.create({
      data: {
        userId,
        message: notificationMessage,
      },
    });

    revalidatePath("/");
    revalidatePath("/expenses");
    return { success: true, transaction };
  } catch (error: any) {
    return { error: error.message || "Failed to create transaction" };
  }
}

// Update an existing Transaction
export async function updateTransaction(id: string, data: any) {
  try {
    const userId = await getUserId();

    const transaction = await prisma.transaction.findUnique({
      where: { id },
    });

    if (!transaction || transaction.userId !== userId) {
      return { error: "Transaction not found" };
    }

    const amount = parseFloat(data.amount);
    if (isNaN(amount) || amount <= 0) {
      return { error: "Amount must be a positive number" };
    }

    const updated = await prisma.transaction.update({
      where: { id },
      data: {
        type: data.type,
        amount,
        category: data.category,
        note: data.note,
        date: data.date ? new Date(data.date) : new Date(),
      },
    });

    revalidatePath("/");
    revalidatePath("/expenses");
    return { success: true, transaction: updated };
  } catch (error: any) {
    return { error: error.message || "Failed to update transaction" };
  }
}

// Delete an existing Transaction
export async function deleteTransaction(id: string) {
  try {
    const userId = await getUserId();

    const transaction = await prisma.transaction.findUnique({
      where: { id },
    });

    if (!transaction || transaction.userId !== userId) {
      return { error: "Transaction not found" };
    }

    await prisma.transaction.delete({
      where: { id },
    });

    revalidatePath("/");
    revalidatePath("/expenses");
    return { success: true };
  } catch (error: any) {
    return { error: error.message || "Failed to delete transaction" };
  }
}
