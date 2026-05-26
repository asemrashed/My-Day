import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// GET /api/tasks - fetch user tasks
export async function GET(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const filter = searchParams.get("filter");

    let whereClause: any = { userId: session.user.id };

    if (filter === "today") {
      const startOfToday = new Date();
      startOfToday.setHours(0, 0, 0, 0);
      const endOfToday = new Date();
      endOfToday.setHours(23, 59, 59, 999);
      whereClause.dueDate = { gte: startOfToday, lte: endOfToday };
    } else if (filter === "upcoming") {
      const now = new Date();
      const in30Min = new Date(now.getTime() + 35 * 60 * 1000);
      whereClause.dueDate = { gte: now, lte: in30Min };
      whereClause.status = { not: "DONE" };
    }

    const tasks = await prisma.task.findMany({
      where: whereClause,
      orderBy: { order: "asc" },
    });

    return NextResponse.json({ tasks });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// POST /api/tasks - create task
export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { title, description, dueDate, priority, category, isRecurring, recurringDays } = body;

    if (!title) {
      return NextResponse.json({ error: "Title is required" }, { status: 400 });
    }

    const maxOrderTask = await prisma.task.findFirst({
      where: { userId: session.user.id },
      orderBy: { order: "desc" },
    });
    const order = maxOrderTask ? maxOrderTask.order + 1 : 0;

    const task = await prisma.task.create({
      data: {
        userId: session.user.id,
        title,
        description,
        dueDate: dueDate ? new Date(dueDate) : null,
        priority: priority || "MEDIUM",
        category: category || "Work",
        status: "PENDING",
        isRecurring: isRecurring || false,
        recurringDays: recurringDays || [],
        order,
      },
    });

    return NextResponse.json({ task }, { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
