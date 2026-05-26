import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// GET /api/events - fetch user events
export async function GET(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const monthStr = searchParams.get("month"); // format: YYYY-MM
    
    let whereClause: any = { userId: session.user.id };

    if (monthStr) {
      const [year, month] = monthStr.split("-").map(Number);
      const startOfMonth = new Date(year, month - 1, 1);
      const endOfMonth = new Date(year, month, 0, 23, 59, 59, 999);
      whereClause.startAt = { gte: startOfMonth, lte: endOfMonth };
    }

    const events = await prisma.event.findMany({
      where: whereClause,
      orderBy: { startAt: "asc" },
    });

    return NextResponse.json({ events });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// POST /api/events - create event
export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { title, startAt, endAt, colorLabel } = body;

    if (!title || !startAt || !endAt) {
      return NextResponse.json({ error: "Title, startAt, and endAt are required" }, { status: 400 });
    }

    const event = await prisma.event.create({
      data: {
        userId: session.user.id,
        title,
        startAt: new Date(startAt),
        endAt: new Date(endAt),
        colorLabel: colorLabel || "emerald",
      },
    });

    return NextResponse.json({ event }, { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// DELETE /api/events?id=xxx
export async function DELETE(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json({ error: "Event ID required" }, { status: 400 });
    }

    const event = await prisma.event.findUnique({ where: { id } });
    if (!event || event.userId !== session.user.id) {
      return NextResponse.json({ error: "Event not found" }, { status: 404 });
    }

    await prisma.event.delete({ where: { id } });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
