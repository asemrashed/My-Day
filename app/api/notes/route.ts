import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  categoryWhere,
  clampLimit,
  decodeCursor,
  encodeCursor,
  noteCategoryOf,
  notePreview,
  NOTE_CATEGORY_ORDER,
} from "@/lib/pagination";
import type { Prisma } from "@prisma/client";

function serializeNoteSummary(note: {
  id: string;
  title: string | null;
  content: string;
  attachments: string[];
  createdAt: Date;
  updatedAt: Date;
}) {
  return {
    id: note.id,
    title: note.title,
    preview: notePreview(note.content),
    attachments: note.attachments,
    createdAt: note.createdAt.toISOString(),
    updatedAt: note.updatedAt.toISOString(),
  };
}

function baseFilters(params: {
  userId: string;
  q: string;
  dateFrom: string | null;
  dateTo: string | null;
}): Prisma.NoteWhereInput {
  const where: Prisma.NoteWhereInput = { userId: params.userId };
  const and: Prisma.NoteWhereInput[] = [];
  if (params.dateFrom || params.dateTo) {
    const updatedAt: Prisma.DateTimeFilter = {};
    if (params.dateFrom) updatedAt.gte = new Date(`${params.dateFrom}T00:00:00.000Z`);
    if (params.dateTo) updatedAt.lte = new Date(`${params.dateTo}T23:59:59.999Z`);
    and.push({ updatedAt });
  }
  if (params.q) {
    and.push({
      OR: [{ title: { contains: params.q } }, { content: { contains: params.q } }],
    });
  }
  if (and.length) where.AND = and;
  return where;
}

export async function GET(request: Request) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ notes: [], nextCursor: null }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const limit = clampLimit(searchParams.get("limit"), 10);
  const cursor = searchParams.get("cursor");
  const q = searchParams.get("q")?.trim() || "";
  const category = searchParams.get("category");
  const dateFrom = searchParams.get("dateFrom");
  const dateTo = searchParams.get("dateTo");
  const meta = searchParams.get("meta");

  const filters = baseFilters({
    userId: session.user.id,
    q,
    dateFrom,
    dateTo,
  });

  // Lightweight category list for category-first browsing.
  if (meta === "groups") {
    const rows = await prisma.note.findMany({
      where: filters,
      select: { attachments: true },
    });
    const counts = new Map<string, number>();
    for (const row of rows) {
      const cat = noteCategoryOf(row.attachments);
      counts.set(cat, (counts.get(cat) || 0) + 1);
    }
    const known = NOTE_CATEGORY_ORDER.filter((name) => (counts.get(name) || 0) > 0);
    const extras = Array.from(counts.keys())
      .filter((name) => !NOTE_CATEGORY_ORDER.includes(name as (typeof NOTE_CATEGORY_ORDER)[number]))
      .sort((a, b) => a.localeCompare(b));
    return NextResponse.json({
      groups: [...known, ...extras].map((name) => ({ name, count: counts.get(name) || 0 })),
    });
  }

  const where: Prisma.NoteWhereInput = { ...filters };
  const and: Prisma.NoteWhereInput[] = Array.isArray(where.AND)
    ? [...where.AND]
    : where.AND
      ? [where.AND]
      : [];

  if (category && category !== "all") {
    and.push(categoryWhere(category));
  }

  const decoded = cursor ? decodeCursor(cursor) : null;
  if (decoded) {
    and.push({
      OR: [
        { updatedAt: { lt: decoded.date } },
        { AND: [{ updatedAt: decoded.date }, { id: { lt: decoded.id } }] },
      ],
    });
  }
  if (and.length) where.AND = and;

  const rows = await prisma.note.findMany({
    where,
    orderBy: { updatedAt: "desc" },
    take: limit + 1,
    select: {
      id: true,
      title: true,
      content: true,
      attachments: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  const page = rows.slice(0, limit);
  const hasMore = rows.length > limit;
  const last = page[page.length - 1];
  const nextCursor = hasMore && last ? encodeCursor(last.updatedAt, last.id) : null;

  return NextResponse.json({
    notes: page.map(serializeNoteSummary),
    nextCursor,
  });
}

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json();
  const { title, content, attachments } = body;

  const note = await prisma.note.create({
    data: {
      userId: session.user.id,
      title,
      content,
      attachments,
    },
  });

  return NextResponse.json({
    ...note,
    createdAt: note.createdAt.toISOString(),
    updatedAt: note.updatedAt.toISOString(),
    preview: notePreview(note.content),
  });
}

export async function PUT(request: Request) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json();
  const { id, title, content, attachments } = body;

  if (!id) return NextResponse.json({ error: "Note ID is required" }, { status: 400 });

  const existingNote = await prisma.note.findUnique({
    where: { id },
  });

  if (!existingNote || existingNote.userId !== session.user.id) {
    return NextResponse.json({ error: "Note not found" }, { status: 404 });
  }

  const updatedNote = await prisma.note.update({
    where: { id },
    data: {
      title: title !== undefined ? title : existingNote.title,
      content: content !== undefined ? content : existingNote.content,
      attachments: attachments !== undefined ? attachments : existingNote.attachments,
    },
  });

  return NextResponse.json({
    ...updatedNote,
    createdAt: updatedNote.createdAt.toISOString(),
    updatedAt: updatedNote.updatedAt.toISOString(),
    preview: notePreview(updatedNote.content),
  });
}

export async function DELETE(request: Request) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");

  if (!id) return NextResponse.json({ error: "Note ID is required" }, { status: 400 });

  const existingNote = await prisma.note.findUnique({
    where: { id },
  });

  if (!existingNote || existingNote.userId !== session.user.id) {
    return NextResponse.json({ error: "Note not found" }, { status: 404 });
  }

  await prisma.$transaction([
    prisma.fileAttachment.deleteMany({
      where: { userId: session.user.id, ownerType: "NOTE", ownerId: id },
    }),
    prisma.link.deleteMany({
      where: {
        userId: session.user.id,
        OR: [
          { sourceType: "NOTE", sourceId: id },
          { targetType: "NOTE", targetId: id },
        ],
      },
    }),
    prisma.note.delete({ where: { id } }),
  ]);

  return NextResponse.json({ success: true });
}
