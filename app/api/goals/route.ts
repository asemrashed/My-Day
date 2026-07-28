import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { recalculateGoalProgress, serializeTask, taskInclude } from "@/lib/task-service";
import { clampLimit, decodeCursor, encodeCursor } from "@/lib/pagination";

async function userId() {
  const session = await auth();
  return session?.user?.id || null;
}

function serializeGoal(
  goal: {
    id: string;
    title: string;
    description: string | null;
    period: string;
    dueDate: Date | null;
    progress: number;
    isCompleted: boolean;
    createdAt: Date;
    parentGoalId: string | null;
  },
  extras: { tasks?: unknown[]; subGoals?: unknown[] } = {}
) {
  return {
    id: goal.id,
    title: goal.title,
    description: goal.description,
    period: goal.period,
    dueDate: goal.dueDate?.toISOString() || null,
    progress: goal.progress,
    isCompleted: goal.isCompleted,
    createdAt: goal.createdAt.toISOString(),
    parentGoalId: goal.parentGoalId,
    tasks: extras.tasks ?? [],
    subGoals: extras.subGoals,
  };
}

export async function GET(request: Request) {
  const id = await userId();
  if (!id) return NextResponse.json({ goals: [], nextCursor: null }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const mode = searchParams.get("mode") || "list";

  // Slim list for pickers / task forms — no tasks, no pagination.
  if (mode === "options") {
    const goals = await prisma.goal.findMany({
      where: { userId: id },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        title: true,
        period: true,
        parentGoalId: true,
        dueDate: true,
        progress: true,
        isCompleted: true,
      },
    });
    return NextResponse.json({
      goals: goals.map((goal) => ({
        ...goal,
        dueDate: goal.dueDate?.toISOString() || null,
      })),
    });
  }

  const limit = clampLimit(searchParams.get("limit"), 6, 30);
  const cursor = searchParams.get("cursor");

  // Fetch user goals once, then treat missing/null parentGoalId as roots in JS.
  // (Mongo `parentGoalId: null` OR `isSet: false` was unreliable and broke cursor pages.)
  const allGoals = await prisma.goal.findMany({
    where: { userId: id },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      title: true,
      description: true,
      period: true,
      dueDate: true,
      progress: true,
      isCompleted: true,
      createdAt: true,
      parentGoalId: true,
    },
  });

  const roots = allGoals.filter((goal) => !goal.parentGoalId);
  const decoded = cursor ? decodeCursor(cursor) : null;
  let start = 0;
  if (decoded) {
    const idx = roots.findIndex((goal) => goal.id === decoded.id);
    start = idx >= 0 ? idx + 1 : 0;
  }

  const page = roots.slice(start, start + limit);
  const hasMore = start + limit < roots.length;
  const last = page[page.length - 1];
  const nextCursor = hasMore && last ? encodeCursor(last.createdAt, last.id) : null;

  const rootIds = page.map((goal) => goal.id);
  const subGoals = allGoals
    .filter((goal) => goal.parentGoalId && rootIds.includes(goal.parentGoalId))
    .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());

  const subsByParent = new Map<string, typeof subGoals>();
  for (const sub of subGoals) {
    if (!sub.parentGoalId) continue;
    const list = subsByParent.get(sub.parentGoalId) || [];
    list.push(sub);
    subsByParent.set(sub.parentGoalId, list);
  }

  return NextResponse.json({
    goals: page.map((goal) =>
      serializeGoal(goal, {
        tasks: [],
        subGoals: (subsByParent.get(goal.id) || []).map((sub) => serializeGoal(sub, { tasks: [] })),
      })
    ),
    nextCursor,
  });
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
  return NextResponse.json(serializeGoal(goal, { tasks: [], subGoals: parentGoalId ? undefined : [] }));
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
  await recalculateGoalProgress(id, { all: true });
  return NextResponse.json(serializeGoal(goal));
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
  await recalculateGoalProgress(id, { all: true });
  return NextResponse.json({ success: true });
}
