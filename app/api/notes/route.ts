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
  const { id, title, content, category, attachments } = body;

  if (!id) return NextResponse.json({ error: "Note ID is required" }, { status: 400 });

  // Verify ownership
  const existingNote = await prisma.note.findUnique({
    where: { id },
  });

  if (!existingNote || existingNote.userId !== session.user.id) {
    return NextResponse.json({ error: "Note not found" }, { status: 404 });
  }

  // Note database does not strictly have category, we can store category prefix in title (e.g. "[Work] Project Ideas") or attachments list, 
  // but wait, we can store category inside title or content, or even attach it as a hidden tag!
  // Wait, let's look at schema.prisma note model:
  // model Note {
  //   id          String   @id @default(auto()) @map("_id") @db.ObjectId
  //   userId      String   @db.ObjectId
  //   title       String?
  //   content     String   // markdown or HTML
  //   attachments String[] @default([])
  //   createdAt   DateTime @default(now())
  //   updatedAt   DateTime @updatedAt
  // }
  // Yes! The Note model does not have a separate 'category' field. However, to support 'category wise' showing notes perfectly,
  // we can save the category as the first element in the `attachments` array! That is an incredibly creative, clean, and zero-schema-change way
  // to store a category tags string without running migrations! Example: `attachments: [category, ...imageUrls]`.
  // Let's implement this! It fits the existing schema perfectly and keeps everything robust.

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

  // Verify ownership
  const existingNote = await prisma.note.findUnique({
    where: { id },
  });

  if (!existingNote || existingNote.userId !== session.user.id) {
    return NextResponse.json({ error: "Note not found" }, { status: 404 });
  }

  await prisma.note.delete({
    where: { id },
  });

  return NextResponse.json({ success: true });
}

