import { redirect } from "next/navigation";
import ProjectsHub from "@/components/ProjectsHub";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function ProjectsPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const userId = session.user.id;
  const [projects, notes, tasks, events, links] = await Promise.all([
    prisma.project.findMany({
      where: { userId },
      orderBy: [{ updatedAt: "desc" }],
    }),
    prisma.note.findMany({
      where: { userId },
      orderBy: { updatedAt: "desc" },
      take: 50,
    }),
    prisma.task.findMany({
      where: { userId },
      orderBy: [{ status: "asc" }, { order: "asc" }],
      take: 80,
    }),
    prisma.event.findMany({
      where: { userId },
      orderBy: { startAt: "desc" },
      take: 80,
    }),
    prisma.link.findMany({
      where: {
        userId,
        sourceType: "PROJECT",
        targetType: { in: ["NOTE", "TASK", "EVENT"] },
      },
    }),
  ]);

  const linkMap = links.reduce<Record<string, { noteIds: string[]; taskIds: string[]; eventIds: string[] }>>(
    (acc, link) => {
      if (!acc[link.sourceId]) acc[link.sourceId] = { noteIds: [], taskIds: [], eventIds: [] };
      if (link.targetType === "NOTE") acc[link.sourceId].noteIds.push(link.targetId);
      if (link.targetType === "TASK") acc[link.sourceId].taskIds.push(link.targetId);
      if (link.targetType === "EVENT") acc[link.sourceId].eventIds.push(link.targetId);
      return acc;
    },
    {}
  );

  return (
    <div className="space-y-6 pb-8">
      <div>
        <h1 className="app-page-title">Projects</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Track project problems, solutions, features, linked work, and PIN-locked credentials.
        </p>
      </div>

      <ProjectsHub
        initialProjects={projects.map((project) => ({
          id: project.id,
          title: project.title,
          group: project.group,
          status: project.status,
          problem: project.problem,
          solution: project.solution,
          features: project.features,
          techStack: project.techStack,
          repoUrl: project.repoUrl,
          liveUrl: project.liveUrl,
          notes: project.notes,
          progress: project.progress,
          startDate: project.startDate?.toISOString() || null,
          dueDate: project.dueDate?.toISOString() || null,
          hasSecret: Boolean(project.secretData),
          createdAt: project.createdAt.toISOString(),
          updatedAt: project.updatedAt.toISOString(),
        }))}
        notes={notes.map((note) => ({
          id: note.id,
          title: note.title,
          content: note.content,
          updatedAt: note.updatedAt.toISOString(),
        }))}
        tasks={tasks.map((task) => ({
          id: task.id,
          title: task.title,
          status: task.status,
          priority: task.priority,
          dueDate: task.dueDate?.toISOString() || null,
        }))}
        events={events.map((event) => ({
          id: event.id,
          title: event.title,
          startAt: event.startAt.toISOString(),
          endAt: event.endAt.toISOString(),
          colorLabel: event.colorLabel,
        }))}
        linkMap={linkMap}
      />
    </div>
  );
}
