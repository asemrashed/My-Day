import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  ALLOWED_EXTENSIONS,
  isAllowedFilename,
  MAX_FILE_SIZE,
  OWNER_TYPES,
  sanitizeFilename,
  toFileDto,
  type FileOwnerType,
} from "@/lib/files";

export const runtime = "nodejs";

async function assertOwnsOwner(userId: string, ownerType: FileOwnerType, ownerId: string) {
  if (ownerType === "NOTE") {
    const note = await prisma.note.findUnique({ where: { id: ownerId } });
    return Boolean(note && note.userId === userId);
  }
  const project = await prisma.project.findUnique({ where: { id: ownerId } });
  return Boolean(project && project.userId === userId);
}

export async function GET(request: Request) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const ownerType = searchParams.get("ownerType") as FileOwnerType | null;
  const ownerId = searchParams.get("ownerId");

  if (!ownerType || !OWNER_TYPES.includes(ownerType) || !ownerId) {
    return NextResponse.json({ error: "ownerType and ownerId are required" }, { status: 400 });
  }

  const owns = await assertOwnsOwner(session.user.id, ownerType, ownerId);
  if (!owns) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const files = await prisma.fileAttachment.findMany({
    where: { userId: session.user.id, ownerType, ownerId },
    select: {
      id: true,
      ownerType: true,
      ownerId: true,
      originalName: true,
      mimeType: true,
      size: true,
      createdAt: true,
    },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json(files.map(toFileDto));
}

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return NextResponse.json({ error: "Invalid multipart body" }, { status: 400 });
  }

  const ownerType = String(form.get("ownerType") || "") as FileOwnerType;
  const ownerId = String(form.get("ownerId") || "");
  const file = form.get("file");

  if (!OWNER_TYPES.includes(ownerType) || !ownerId) {
    return NextResponse.json({ error: "ownerType and ownerId are required" }, { status: 400 });
  }
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "file is required" }, { status: 400 });
  }
  if (!isAllowedFilename(file.name)) {
    return NextResponse.json(
      {
        error: `File type not allowed. Allowed: ${Array.from(ALLOWED_EXTENSIONS).join(", ")}`,
      },
      { status: 400 }
    );
  }
  if (file.size <= 0) {
    return NextResponse.json({ error: "Empty files are not allowed" }, { status: 400 });
  }
  if (file.size > MAX_FILE_SIZE) {
    return NextResponse.json({ error: "File exceeds the 4 MB limit" }, { status: 400 });
  }

  const owns = await assertOwnsOwner(session.user.id, ownerType, ownerId);
  if (!owns) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const originalName = sanitizeFilename(file.name);
  const buffer = Buffer.from(await file.arrayBuffer());

  const row = await prisma.fileAttachment.create({
    data: {
      userId: session.user.id,
      ownerType,
      ownerId,
      originalName,
      mimeType: file.type || "application/octet-stream",
      size: buffer.length,
      data: buffer,
    },
    select: {
      id: true,
      ownerType: true,
      ownerId: true,
      originalName: true,
      mimeType: true,
      size: true,
      createdAt: true,
    },
  });

  return NextResponse.json(toFileDto(row), { status: 201 });
}
