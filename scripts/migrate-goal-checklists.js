const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();

function parseDescription(value) {
  if (!value) return null;
  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === "object" ? parsed : null;
  } catch {
    return null;
  }
}

async function migrateGoal(goal) {
  const description = parseDescription(goal.description);
  const checklist = Array.isArray(description?.checklist) ? description.checklist : [];
  if (checklist.length === 0) return 0;

  const maxOrderTask = await prisma.task.findFirst({
    where: { userId: goal.userId },
    orderBy: { order: "desc" },
  });
  let order = maxOrderTask ? maxOrderTask.order + 1 : 0;
  let created = 0;

  for (const item of checklist) {
    if (!item || typeof item.text !== "string" || !item.text.trim()) continue;
    const migrationId = `${goal.id}:${String(item.id || item.text)}`;
    const exists = await prisma.task.findFirst({
      where: { userId: goal.userId, legacyChecklistId: migrationId },
      select: { id: true },
    });
    if (exists) continue;

    await prisma.task.create({
      data: {
        userId: goal.userId,
        title: item.text.trim(),
        description: null,
        dueDate: goal.dueDate,
        priority: "MEDIUM",
        category: "Goal",
        status: item.done ? "DONE" : "PENDING",
        isRecurring: false,
        recurringDays: [],
        order: order++,
        goalId: goal.parentGoalId || goal.id,
        subGoalId: goal.parentGoalId ? goal.id : null,
        legacyChecklistId: migrationId,
      },
    });
    created += 1;
  }

  await prisma.goal.update({
    where: { id: goal.id },
    data: {
      description: JSON.stringify({
        ...description,
        checklist: [],
        checklistMigratedAt: new Date().toISOString(),
      }),
    },
  });

  return created;
}

async function recalculateProgress(goals) {
  const children = new Map();
  for (const goal of goals) {
    const key = goal.parentGoalId || "";
    children.set(key, [...(children.get(key) || []), goal.id]);
  }

  const descendants = (goalId) => {
    const ids = [goalId];
    for (const childId of children.get(goalId) || []) ids.push(...descendants(childId));
    return ids;
  };

  for (const goal of goals) {
    const ids = descendants(goal.id);
    const tasks = await prisma.task.findMany({
      where: {
        userId: goal.userId,
        OR: [{ goalId: { in: ids } }, { subGoalId: { in: ids } }],
      },
      select: { id: true, status: true },
    });
    const uniqueTasks = new Map(tasks.map((task) => [task.id, task]));
    const total = uniqueTasks.size;
    const completed = [...uniqueTasks.values()].filter((task) => task.status === "DONE").length;
    const progress = total === 0 ? 0 : Math.round((completed / total) * 100);
    await prisma.goal.update({
      where: { id: goal.id },
      data: { progress, isCompleted: total > 0 && completed === total },
    });
  }
}

async function main() {
  const goals = await prisma.goal.findMany();
  let created = 0;
  for (const goal of goals) created += await migrateGoal(goal);
  await recalculateProgress(goals);
  console.log(`Migrated ${created} legacy checklist item(s) into tasks.`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
