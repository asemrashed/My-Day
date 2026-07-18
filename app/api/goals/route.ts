import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { recalculateGoalProgress, serializeTask, taskInclude } from "@/lib/task-service";

async function userId() {
  const session = await auth();
  return session?.user?.id || null;
}

export async function GET() {
  const id = await userId();
  if (!id) return NextResponse.json([], { status: 401 });
  await recalculateGoalProgress(id);
  const [goals, tasks] = await Promise.all([
    prisma.goal.findMany({ where: { userId: id }, orderBy: { createdAt: "desc" } }),
    prisma.task.findMany({
      where: { userId: id, OR: [{ goalId: { not: null } }, { subGoalId: { not: null } }] },
      orderBy: { order: "asc" },
      include: taskInclude,
    }),
  ]);
  return NextResponse.json(
    goals.map((goal) => ({
      ...goal,
      dueDate: goal.dueDate?.toISOString() || null,
      createdAt: goal.createdAt.toISOString(),
      tasks: tasks
        .filter((task) => (goal.parentGoalId ? task.subGoalId === goal.id : task.goalId === goal.id && !task.subGoalId))
        .map(serializeTask),
    }))
  );
}

export async function POST(request: Request) {
  const id = await userId();
  if (!id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = await request.json();
  if (!body.title?.trim()) return NextResponse.json({ error: "Title is required" }, { status: 400 });

  const parentGoalId: string | null = body.parentGoalId || null;
  if (parentGoalId) {
    const parent = await prisma.goal.findFirst({ where: { id: parentGoalId, userId: id }, select: { id: true } });
    if (!parent) return NextResponse.json({ error: "Parent goal not found" }, { status: 400 });
  }
  const goal = await prisma.goal.create({
    data: {
      userId: id,
      title: body.title.trim(),
      description: body.description || null,
      period: body.period || "CUSTOM",
      dueDate: body.dueDate ? new Date(body.dueDate) : null,
      parentGoalId,
    },
  });
  return NextResponse.json(goal);
}

export async function PUT(request: Request) {
  const id = await userId();
  if (!id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = await request.json();
  if (!body.id) return NextResponse.json({ error: "Goal ID is required" }, { status: 400 });
  const existing = await prisma.goal.findFirst({ where: { id: body.id, userId: id } });
  if (!existing) return NextResponse.json({ error: "Goal not found" }, { status: 404 });

  const parentGoalId = body.parentGoalId !== undefined ? body.parentGoalId || null : existing.parentGoalId;
  if (parentGoalId === existing.id) return NextResponse.json({ error: "A goal cannot be its own parent" }, { status: 400 });
  if (parentGoalId) {
    const parent = await prisma.goal.findFirst({ where: { id: parentGoalId, userId: id }, select: { id: true } });
    if (!parent) return NextResponse.json({ error: "Parent goal not found" }, { status: 400 });
    const child = await prisma.goal.findFirst({ where: { userId: id, parentGoalId: existing.id }, select: { id: true } });
    if (child) return NextResponse.json({ error: "A goal with sub-goals cannot become a sub-goal" }, { status: 400 });
  }

  const goal = await prisma.goal.update({
    where: { id: existing.id },
    data: {
      title: body.title !== undefined ? body.title.trim() : existing.title,
      description: body.description !== undefined ? body.description : existing.description,
      period: body.period !== undefined ? body.period : existing.period,
      dueDate: body.dueDate !== undefined ? (body.dueDate ? new Date(body.dueDate) : null) : existing.dueDate,
      parentGoalId,
    },
  });
  if (parentGoalId !== existing.parentGoalId) {
    if (parentGoalId) {
      await prisma.task.updateMany({
        where: { userId: id, OR: [{ goalId: existing.id, subGoalId: null }, { subGoalId: existing.id }] },
        data: { goalId: parentGoalId, subGoalId: existing.id },
      });
    } else {
      await prisma.task.updateMany({
        where: { userId: id, subGoalId: existing.id },
        data: { goalId: existing.id, subGoalId: null },
      });
    }
  }
  await recalculateGoalProgress(id);
  return NextResponse.json(goal);
}

export async function DELETE(request: Request) {
  const id = await userId();
  if (!id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const goalId = new URL(request.url).searchParams.get("id");
  if (!goalId) return NextResponse.json({ error: "Goal ID is required" }, { status: 400 });
  const existing = await prisma.goal.findFirst({ where: { id: goalId, userId: id } });
  if (!existing) return NextResponse.json({ error: "Goal not found" }, { status: 404 });

  const childTasks = await prisma.task.findMany({
    where: { userId: id, goalId, subGoalId: { not: null } },
    select: { id: true, subGoalId: true },
  });
  await prisma.$transaction([
    ...childTasks.map((task) =>
      prisma.task.update({ where: { id: task.id }, data: { goalId: task.subGoalId, subGoalId: null } })
    ),
    prisma.task.updateMany({ where: { userId: id, goalId, subGoalId: null }, data: { goalId: null } }),
    prisma.task.updateMany({ where: { userId: id, subGoalId: goalId }, data: { subGoalId: null } }),
    prisma.goal.updateMany({ where: { userId: id, parentGoalId: goalId }, data: { parentGoalId: null } }),
    prisma.goal.delete({ where: { id: goalId } }),
  ]);
  await recalculateGoalProgress(id);
  return NextResponse.json({ success: true });
}
