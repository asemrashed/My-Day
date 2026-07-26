import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

type RouteContext = { params: { id: string } };

export async function GET(_request: Request, context: RouteContext) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const file = await prisma.fileAttachment.findUnique({ where: { id: context.params.id } });
  if (!file || file.userId !== session.user.id) {
    return NextResponse.json({ error: "File not found" }, { status: 404 });
  }

  if (!file.data || file.data.length === 0) {
    return NextResponse.json({ error: "File data missing" }, { status: 404 });
  }

  const headers = new Headers();
  headers.set("Content-Type", file.mimeType || "application/octet-stream");
  headers.set(
    "Content-Disposition",
    `attachment; filename*=UTF-8''${encodeURIComponent(file.originalName)}`
  );
  headers.set("Content-Length", String(file.data.length));
  headers.set("Cache-Control", "private, no-store");

  return new NextResponse(new Uint8Array(file.data), { status: 200, headers });
}

export async function DELETE(_request: Request, context: RouteContext) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const file = await prisma.fileAttachment.findUnique({
    where: { id: context.params.id },
    select: { id: true, userId: true },
  });
  if (!file || file.userId !== session.user.id) {
    return NextResponse.json({ error: "File not found" }, { status: 404 });
  }

  await prisma.fileAttachment.delete({ where: { id: file.id } });
  return NextResponse.json({ success: true });
}
