import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json([], { status: 401 });

  const goals = await prisma.goal.findMany({
    where: { userId: session.user.id },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json(goals);
}

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json();
  const { title, description, period, dueDate } = body;

  const goal = await prisma.goal.create({
    data: {
      userId: session.user.id,
      title,
      description,
      period: period || "CUSTOM",
      dueDate: dueDate ? new Date(dueDate) : undefined,
    },
  });

  return NextResponse.json(goal);
}

export async function PUT(request: Request) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json();
  const { id, title, description, period, dueDate, progress, isCompleted } = body;

  if (!id) return NextResponse.json({ error: "Goal ID is required" }, { status: 400 });

  // Verify ownership
  const existingGoal = await prisma.goal.findUnique({
    where: { id },
  });

  if (!existingGoal || existingGoal.userId !== session.user.id) {
    return NextResponse.json({ error: "Goal not found" }, { status: 404 });
  }

  const updatedGoal = await prisma.goal.update({
    where: { id },
    data: {
      title: title !== undefined ? title : existingGoal.title,
      description: description !== undefined ? description : existingGoal.description,
      period: period !== undefined ? period : existingGoal.period,
      dueDate: dueDate !== undefined ? (dueDate ? new Date(dueDate) : null) : existingGoal.dueDate,
      progress: progress !== undefined ? parseInt(String(progress)) : existingGoal.progress,
      isCompleted: isCompleted !== undefined ? isCompleted : existingGoal.isCompleted,
    },
  });

  return NextResponse.json(updatedGoal);
}

export async function DELETE(request: Request) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");

  if (!id) return NextResponse.json({ error: "Goal ID is required" }, { status: 400 });

  // Verify ownership
  const existingGoal = await prisma.goal.findUnique({
    where: { id },
  });

  if (!existingGoal || existingGoal.userId !== session.user.id) {
    return NextResponse.json({ error: "Goal not found" }, { status: 404 });
  }

  await prisma.goal.delete({
    where: { id },
  });

  return NextResponse.json({ success: true });
}

