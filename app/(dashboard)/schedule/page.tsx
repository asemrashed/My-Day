import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import CalendarView from "@/components/CalendarView";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function SchedulePage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);

  // Fetch this month's events
  const events = await prisma.event.findMany({
    where: {
      userId: session.user.id,
      startAt: { gte: startOfMonth, lte: endOfMonth },
    },
    orderBy: { startAt: "asc" },
  });

  // Upcoming 5 tasks
  const upcomingTasks = await prisma.task.findMany({
    where: {
      userId: session.user.id,
      status: { not: "DONE" },
      dueDate: { gte: now },
    },
    orderBy: { dueDate: "asc" },
    take: 5,
  });

  // Active goals with a target date (shown on the calendar)
  const goals = await prisma.goal.findMany({
    where: {
      userId: session.user.id,
      isCompleted: false,
      dueDate: { not: null },
    },
    orderBy: { dueDate: "asc" },
  });

  const formattedEvents = events.map((e) => ({
    id: e.id,
    title: e.title,
    startAt: e.startAt.toISOString(),
    endAt: e.endAt.toISOString(),
    colorLabel: e.colorLabel,
  }));

  const formattedTasks = upcomingTasks.map((t) => ({
    id: t.id,
    title: t.title,
    dueDate: t.dueDate ? t.dueDate.toISOString() : null,
    priority: t.priority,
    status: t.status,
  }));

  const formattedGoals = goals.map((g) => ({
    id: g.id,
    title: g.title,
    dueDate: g.dueDate!.toISOString(),
    progress: g.progress,
    period: g.period,
  }));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="app-page-title">
          Schedule & Calendar
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Click on any day to add an event. Click an event to delete it.
        </p>
      </div>
      <CalendarView initialEvents={formattedEvents} upcomingTasks={formattedTasks} goals={formattedGoals} />
    </div>
  );
}
