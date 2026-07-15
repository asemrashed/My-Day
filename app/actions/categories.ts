"use server";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { CategoryType, getDefaultCategories } from "@/lib/categories";
import { revalidatePath } from "next/cache";

export type CategoryItem = {
  id: string;
  name: string;
  type: string;
  isDefault: boolean;
};

async function getUserId() {
  const session = await auth();
  if (!session?.user?.id) {
    throw new Error("Unauthorized");
  }
  return session.user.id;
}

function normalizeType(type: string): CategoryType | null {
  if (type === "INCOME" || type === "EXPENSE") return type;
  return null;
}

async function ensureUserCategories(userId: string) {
  if (!("category" in prisma) || typeof (prisma as { category?: { findMany: unknown } }).category?.findMany !== "function") {
    throw new Error("Category model unavailable. Restart the app after prisma generate.");
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { categoriesSeeded: true },
  });

  if (user?.categoriesSeeded) return;

  const existing = await prisma.category.findMany({
    where: { userId },
    select: { type: true, name: true },
  });
  const keys = new Set(existing.map((e) => `${e.type}::${e.name.toLowerCase()}`));

  const toCreate: { userId: string; type: string; name: string }[] = [];
  for (const type of ["EXPENSE", "INCOME"] as CategoryType[]) {
    for (const name of getDefaultCategories(type)) {
      if (!keys.has(`${type}::${name.toLowerCase()}`)) {
        toCreate.push({ userId, type, name });
      }
    }
  }

  if (toCreate.length > 0) {
    await prisma.category.createMany({ data: toCreate });
  }

  await prisma.user.update({
    where: { id: userId },
    data: { categoriesSeeded: true },
  });
}

export async function getCategories(type?: CategoryType) {
  try {
    const userId = await getUserId();
    await ensureUserCategories(userId);

    const where = type ? { userId, type } : { userId };
    const rows = await prisma.category.findMany({
      where,
      orderBy: [{ type: "asc" }, { createdAt: "asc" }],
    });

    const defaultExpense = new Set(getDefaultCategories("EXPENSE").map((n) => n.toLowerCase()));
    const defaultIncome = new Set(getDefaultCategories("INCOME").map((n) => n.toLowerCase()));

    const items: CategoryItem[] = rows.map((r) => ({
      id: r.id,
      name: r.name,
      type: r.type,
      isDefault:
        r.type === "EXPENSE"
          ? defaultExpense.has(r.name.toLowerCase())
          : defaultIncome.has(r.name.toLowerCase()),
    }));

    const expense = items.filter((i) => i.type === "EXPENSE").map((i) => i.name);
    const income = items.filter((i) => i.type === "INCOME").map((i) => i.name);

    if (type) {
      return {
        success: true as const,
        categories: type === "EXPENSE" ? expense : income,
        items: items.filter((i) => i.type === type),
        expense,
        income,
      };
    }

    return {
      success: true as const,
      expense,
      income,
      items,
    };
  } catch (error) {
    return {
      success: false as const,
      error: error instanceof Error ? error.message : "Failed to load categories",
      expense: getDefaultCategories("EXPENSE"),
      income: getDefaultCategories("INCOME"),
      items: [] as CategoryItem[],
      categories: type === "INCOME" ? getDefaultCategories("INCOME") : getDefaultCategories("EXPENSE"),
    };
  }
}

export async function createCategory(type: string, name: string) {
  try {
    const userId = await getUserId();
    await ensureUserCategories(userId);

    const categoryType = normalizeType(type);
    const trimmed = name.trim();

    if (!categoryType) {
      return { success: false as const, error: "Invalid category type" };
    }
    if (!trimmed) {
      return { success: false as const, error: "Category name is required" };
    }
    if (trimmed.length > 80) {
      return { success: false as const, error: "Category name is too long" };
    }

    const existingForType = await prisma.category.findMany({
      where: { userId, type: categoryType },
      select: { name: true },
    });
    if (existingForType.some((c) => c.name.toLowerCase() === trimmed.toLowerCase())) {
      return { success: false as const, error: "You already have this category" };
    }

    const category = await prisma.category.create({
      data: {
        userId,
        type: categoryType,
        name: trimmed,
      },
    });

    revalidatePath("/expenses");
    revalidatePath("/");

    return {
      success: true as const,
      category: {
        id: category.id,
        name: category.name,
        type: category.type,
        isDefault: false,
      },
    };
  } catch (error) {
    return {
      success: false as const,
      error: error instanceof Error ? error.message : "Failed to create category",
    };
  }
}

export async function updateCategory(id: string, name: string) {
  try {
    const userId = await getUserId();
    const trimmed = name.trim();
    if (!trimmed) {
      return { success: false as const, error: "Category name is required" };
    }
    if (trimmed.length > 80) {
      return { success: false as const, error: "Category name is too long" };
    }

    const existing = await prisma.category.findFirst({ where: { id, userId } });
    if (!existing) {
      return { success: false as const, error: "Category not found" };
    }

    const duplicates = await prisma.category.findMany({
      where: { userId, type: existing.type },
      select: { id: true, name: true },
    });
    if (
      duplicates.some(
        (c) => c.id !== id && c.name.toLowerCase() === trimmed.toLowerCase()
      )
    ) {
      return { success: false as const, error: "You already have this category" };
    }

    const oldName = existing.name;
    const category = await prisma.category.update({
      where: { id },
      data: { name: trimmed },
    });

    // Keep transaction labels in sync when renaming
    if (oldName !== trimmed) {
      await prisma.transaction.updateMany({
        where: { userId, type: existing.type, category: oldName },
        data: { category: trimmed },
      });
    }

    const defaults = new Set(
      getDefaultCategories(existing.type as CategoryType).map((n) => n.toLowerCase())
    );

    revalidatePath("/expenses");
    revalidatePath("/");

    return {
      success: true as const,
      category: {
        id: category.id,
        name: category.name,
        type: category.type,
        isDefault: defaults.has(category.name.toLowerCase()),
      },
      oldName,
    };
  } catch (error) {
    return {
      success: false as const,
      error: error instanceof Error ? error.message : "Failed to update category",
    };
  }
}

export async function deleteCategory(id: string) {
  try {
    const userId = await getUserId();
    const category = await prisma.category.findFirst({ where: { id, userId } });

    if (!category) {
      return { success: false as const, error: "Category not found" };
    }

    await prisma.category.delete({ where: { id } });
    revalidatePath("/expenses");
    revalidatePath("/");

    return { success: true as const, deleted: { id: category.id, name: category.name, type: category.type } };
  } catch (error) {
    return {
      success: false as const,
      error: error instanceof Error ? error.message : "Failed to delete category",
    };
  }
}

export async function deleteCategoryByName(type: string, name: string) {
  try {
    const userId = await getUserId();
    const categoryType = normalizeType(type);
    const trimmed = name.trim();
    if (!categoryType || !trimmed) {
      return { success: false as const, error: "Invalid category" };
    }

    const category = await prisma.category.findFirst({
      where: { userId, type: categoryType, name: trimmed },
    });

    if (!category) {
      // Try case-insensitive match
      const all = await prisma.category.findMany({ where: { userId, type: categoryType } });
      const match = all.find((c) => c.name.toLowerCase() === trimmed.toLowerCase());
      if (!match) {
        return { success: false as const, error: "Category not found" };
      }
      await prisma.category.delete({ where: { id: match.id } });
      revalidatePath("/expenses");
      return { success: true as const, deleted: { id: match.id, name: match.name, type: match.type } };
    }

    await prisma.category.delete({ where: { id: category.id } });
    revalidatePath("/expenses");
    revalidatePath("/");

    return { success: true as const, deleted: { id: category.id, name: category.name, type: category.type } };
  } catch (error) {
    return {
      success: false as const,
      error: error instanceof Error ? error.message : "Failed to delete category",
    };
  }
}
