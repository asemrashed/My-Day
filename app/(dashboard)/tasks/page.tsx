import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import TaskBoard from "@/components/TaskBoard";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function TasksPage() {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/login");
  }

  // Fetch all tasks for the logged in user
  const tasks = await prisma.task.findMany({
    where: { userId: session.user.id },
    orderBy: { order: "asc" },
  });

  // Map Decimal or other custom types if necessary, though standard MongoDB types map cleanly
  const formattedTasks = tasks.map((task) => ({
    id: task.id,
    title: task.title,
    description: task.description,
    dueDate: task.dueDate ? task.dueDate.toISOString() : null,
    priority: task.priority,
    category: task.category,
    status: task.status,
    isRecurring: task.isRecurring,
    recurringDays: task.recurringDays,
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

      <TaskBoard initialTasks={formattedTasks} />
    </div>
  );
}
