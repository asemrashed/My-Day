import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { notePreview } from "@/lib/pagination";

type Params = { params: { id: string } };

export async function GET(_request: Request, { params }: Params) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const note = await prisma.note.findFirst({
    where: { id: params.id, userId: session.user.id },
  });
  if (!note) return NextResponse.json({ error: "Note not found" }, { status: 404 });

  return NextResponse.json({
    id: note.id,
    title: note.title,
    content: note.content,
    preview: notePreview(note.content),
    attachments: note.attachments,
    createdAt: note.createdAt.toISOString(),
    updatedAt: note.updatedAt.toISOString(),
  });
}
