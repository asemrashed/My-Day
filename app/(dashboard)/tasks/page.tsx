import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import TaskBoard from "@/components/TaskBoard";
import { redirect } from "next/navigation";
import { serializeTask, taskInclude } from "@/lib/task-service";

export const dynamic = "force-dynamic";

export default async function TasksPage() {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/login");
  }

  const [tasks, groups, allGoals] = await Promise.all([
    prisma.task.findMany({
      where: { userId: session.user.id },
      orderBy: { order: "asc" },
      include: taskInclude,
    }),
    prisma.taskGroup.findMany({
      where: { userId: session.user.id },
      orderBy: { groupDate: "desc" },
    }),
    prisma.goal.findMany({
      where: { userId: session.user.id },
      orderBy: { createdAt: "desc" },
      select: { id: true, title: true, period: true, parentGoalId: true },
    }),
  ]);
  const goals = allGoals
    .filter((goal) => !goal.parentGoalId)
    .map((goal) => ({
      ...goal,
      subGoals: allGoals.filter((candidate) => candidate.parentGoalId === goal.id),
    }));

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-1 text-left">
        <h1 className="app-page-title">
          Task Manager
        </h1>
        <p className="text-sm text-muted-foreground">
          Plan, organize, and drag to prioritize your work. Tasks automatically sync in real-time.
        </p>
      </div>

      <TaskBoard
        initialTasks={tasks.map(serializeTask)}
        initialGroups={groups.map((group) => ({
          id: group.id,
          title: group.title,
          groupDate: group.groupDate.toISOString(),
        }))}
        goals={goals}
      />
    </div>
  );
}
