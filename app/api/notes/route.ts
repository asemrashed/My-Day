import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json([], { status: 401 });

  const notes = await prisma.note.findMany({
    where: { userId: session.user.id },
    orderBy: { updatedAt: "desc" },
  });

  return NextResponse.json(notes);
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

  return NextResponse.json(note);
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

  return NextResponse.json(updatedNote);
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
