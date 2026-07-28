import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { serializeTask, taskInclude } from "@/lib/task-service";

type Params = { params: { id: string } };

export async function GET(_request: Request, { params }: Params) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const goal = await prisma.goal.findFirst({
    where: { id: params.id, userId: session.user.id },
    select: { id: true, parentGoalId: true },
  });
  if (!goal) return NextResponse.json({ error: "Goal not found" }, { status: 404 });

  const tasks = await prisma.task.findMany({
    where: goal.parentGoalId
      ? { userId: session.user.id, subGoalId: goal.id }
      : { userId: session.user.id, goalId: goal.id, subGoalId: null },
    orderBy: { order: "asc" },
    include: taskInclude,
  });

  return NextResponse.json({ tasks: tasks.map(serializeTask) });
}
