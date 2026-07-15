import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const SOURCE_TYPES = ["NOTE", "GOAL", "TASK"];
const TARGET_TYPES = ["TRANSACTION", "GOAL", "TASK", "NOTE"];

// GET /api/links?sourceType=NOTE&sourceId=... -> links with hydrated target data
export async function GET(request: Request) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json([], { status: 401 });

  const { searchParams } = new URL(request.url);
  const sourceType = searchParams.get("sourceType");
  const sourceId = searchParams.get("sourceId");

  if (!sourceType || !sourceId) {
    return NextResponse.json({ error: "sourceType and sourceId are required" }, { status: 400 });
  }

  const links = await prisma.link.findMany({
    where: { userId: session.user.id, sourceType, sourceId },
    orderBy: { createdAt: "asc" },
  });

  // Hydrate targets with live data, grouped per type to avoid N+1 queries
  const idsByType: Record<string, string[]> = {};
  for (const link of links) {
    (idsByType[link.targetType] ||= []).push(link.targetId);
  }

  const userId = session.user.id;
  const targets = new Map<string, unknown>();

  if (idsByType.TRANSACTION?.length) {
    const rows = await prisma.transaction.findMany({
      where: { id: { in: idsByType.TRANSACTION }, userId },
    });
    rows.forEach((r) =>
      targets.set(`TRANSACTION:${r.id}`, {
        id: r.id,
        type: r.type,
        amount: r.amount,
        category: r.category,
        note: r.note,
        date: r.date.toISOString(),
      })
    );
  }

  if (idsByType.GOAL?.length) {
    const rows = await prisma.goal.findMany({
      where: { id: { in: idsByType.GOAL }, userId },
    });
    rows.forEach((r) =>
      targets.set(`GOAL:${r.id}`, {
        id: r.id,
        title: r.title,
        period: r.period,
        progress: r.progress,
        isCompleted: r.isCompleted,
        dueDate: r.dueDate ? r.dueDate.toISOString() : null,
      })
    );
  }

  if (idsByType.TASK?.length) {
    const rows = await prisma.task.findMany({
      where: { id: { in: idsByType.TASK }, userId },
    });
    rows.forEach((r) =>
      targets.set(`TASK:${r.id}`, {
        id: r.id,
        title: r.title,
        status: r.status,
        priority: r.priority,
        category: r.category,
        dueDate: r.dueDate ? r.dueDate.toISOString() : null,
      })
    );
  }

  if (idsByType.NOTE?.length) {
    const rows = await prisma.note.findMany({
      where: { id: { in: idsByType.NOTE }, userId },
    });
    rows.forEach((r) =>
      targets.set(`NOTE:${r.id}`, {
        id: r.id,
        title: r.title,
        updatedAt: r.updatedAt.toISOString(),
      })
    );
  }

  const hydrated = links.map((link) => ({
    id: link.id,
    sourceType: link.sourceType,
    sourceId: link.sourceId,
    targetType: link.targetType,
    targetId: link.targetId,
    // null target means the referenced item was deleted
    target: targets.get(`${link.targetType}:${link.targetId}`) ?? null,
  }));

  return NextResponse.json(hydrated);
}

// POST /api/links { sourceType, sourceId, targets: [{ targetType, targetId }] }
export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json();
  const { sourceType, sourceId, targets } = body;

  if (!SOURCE_TYPES.includes(sourceType) || !sourceId || !Array.isArray(targets) || targets.length === 0) {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  for (const t of targets) {
    if (!TARGET_TYPES.includes(t.targetType) || !t.targetId) {
      return NextResponse.json({ error: "Invalid target" }, { status: 400 });
    }
  }

  const userId = session.user.id;

  // Skip duplicates (unique constraint) instead of failing the whole batch
  const existing = await prisma.link.findMany({
    where: { userId, sourceType, sourceId },
    select: { targetType: true, targetId: true },
  });
  const existingKeys = new Set(existing.map((l) => `${l.targetType}:${l.targetId}`));

  const toCreate = targets.filter(
    (t: { targetType: string; targetId: string }) => !existingKeys.has(`${t.targetType}:${t.targetId}`)
  );

  if (toCreate.length > 0) {
    await prisma.link.createMany({
      data: toCreate.map((t: { targetType: string; targetId: string }) => ({
        userId,
        sourceType,
        sourceId,
        targetType: t.targetType,
        targetId: t.targetId,
      })),
    });
  }

  return NextResponse.json({ success: true, created: toCreate.length });
}

// DELETE /api/links?id=...
export async function DELETE(request: Request) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");

  if (!id) return NextResponse.json({ error: "Link ID is required" }, { status: 400 });

  const link = await prisma.link.findUnique({ where: { id } });
  if (!link || link.userId !== session.user.id) {
    return NextResponse.json({ error: "Link not found" }, { status: 404 });
  }

  await prisma.link.delete({ where: { id } });
  return NextResponse.json({ success: true });
}
