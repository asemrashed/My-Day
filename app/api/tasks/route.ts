import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { createTaskRecord, serializeTask, taskInclude } from "@/lib/task-service";
import type { Prisma } from "@prisma/client";

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Unexpected task error";
}

// GET /api/tasks - fetch user tasks
export async function GET(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const filter = searchParams.get("filter");

    const whereClause: Prisma.TaskWhereInput = { userId: session.user.id };

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
      include: taskInclude,
    });

    const groups = await prisma.taskGroup.findMany({
      where: { userId: session.user.id },
      orderBy: { groupDate: "desc" },
    });

    return NextResponse.json({
      tasks: tasks.map(serializeTask),
      groups: groups.map((group) => ({
        id: group.id,
        title: group.title,
        groupDate: group.groupDate.toISOString(),
      })),
    });
  } catch (error: unknown) {
    return NextResponse.json({ error: errorMessage(error) }, { status: 500 });
  }
}

// POST /api/tasks - create task
export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const task = await createTaskRecord(session.user.id, await req.json());
    return NextResponse.json({ task: serializeTask(task) }, { status: 201 });
  } catch (error: unknown) {
    return NextResponse.json({ error: errorMessage(error) }, { status: 500 });
  }
}
