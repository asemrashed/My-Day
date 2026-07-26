import fs from "fs/promises";
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { removeStoredFile, storedFilePath } from "@/lib/files";

export const runtime = "nodejs";

type RouteContext = { params: { id: string } };

export async function GET(_request: Request, context: RouteContext) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const file = await prisma.fileAttachment.findUnique({ where: { id: context.params.id } });
  if (!file || file.userId !== session.user.id) {
    return NextResponse.json({ error: "File not found" }, { status: 404 });
  }

  try {
    const data = await fs.readFile(storedFilePath(session.user.id, file.storedName));
    const headers = new Headers();
    headers.set("Content-Type", file.mimeType || "application/octet-stream");
    headers.set(
      "Content-Disposition",
      `attachment; filename*=UTF-8''${encodeURIComponent(file.originalName)}`
    );
    headers.set("Content-Length", String(data.length));
    headers.set("Cache-Control", "private, no-store");
    return new NextResponse(data, { status: 200, headers });
  } catch {
    return NextResponse.json({ error: "File missing on disk" }, { status: 404 });
  }
}

export async function DELETE(_request: Request, context: RouteContext) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const file = await prisma.fileAttachment.findUnique({ where: { id: context.params.id } });
  if (!file || file.userId !== session.user.id) {
    return NextResponse.json({ error: "File not found" }, { status: 404 });
  }

  await prisma.fileAttachment.delete({ where: { id: file.id } });
  await removeStoredFile(session.user.id, file.storedName);

  return NextResponse.json({ success: true });
}
