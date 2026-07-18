import { NextRequest, NextResponse } from "next/server";
import type { Prisma } from "@prisma/client";
import { auth } from "@/lib/auth";
import { normalizeAccount } from "@/lib/finance";
import { prisma } from "@/lib/prisma";

async function isLoanManagedTransaction(id: string, userId: string) {
  const [loan, payment] = await Promise.all([
    prisma.loan.findFirst({ where: { userId, transactionId: id }, select: { id: true } }),
    prisma.loanPayment.findFirst({ where: { userId, transactionId: id }, select: { id: true } }),
  ]);
  return Boolean(loan || payment);
}

// GET /api/transactions
export async function GET(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { searchParams } = new URL(req.url);
    const type = searchParams.get("type"); // INCOME | EXPENSE
    const category = searchParams.get("category");
    const account = searchParams.get("account");
    const from = searchParams.get("from");
    const to = searchParams.get("to");
    const search = searchParams.get("search");

    const whereClause: Prisma.TransactionWhereInput = { userId: session.user.id };
    if (type) whereClause.type = type;
    if (category) whereClause.category = { contains: category, mode: "insensitive" };
    if (account) whereClause.account = normalizeAccount(account);
    if (from || to) {
      whereClause.date = {};
      if (from) whereClause.date.gte = new Date(from);
      if (to) whereClause.date.lte = new Date(to);
    }
    if (search) {
      whereClause.OR = [
        { note: { contains: search, mode: "insensitive" } },
        { category: { contains: search, mode: "insensitive" } },
      ];
    }

    const transactions = await prisma.transaction.findMany({
      where: whereClause,
      orderBy: { date: "desc" },
    });

    return NextResponse.json({ transactions });
  } catch (error: unknown) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to fetch transactions" },
      { status: 500 }
    );
  }
}

// POST /api/transactions
export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { type, amount, category, account, note, date } = await req.json();

    if (!type || !amount || !category) {
      return NextResponse.json({ error: "Type, amount and category required" }, { status: 400 });
    }

    const transaction = await prisma.transaction.create({
      data: {
        userId: session.user.id,
        type,
        amount: parseFloat(amount),
        category,
        account: normalizeAccount(account),
        note,
        date: date ? new Date(date) : new Date(),
      },
    });

    return NextResponse.json({ transaction }, { status: 201 });
  } catch (error: unknown) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to create transaction" },
      { status: 500 }
    );
  }
}

// DELETE /api/transactions?id=xxx
export async function DELETE(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const id = new URL(req.url).searchParams.get("id");
    if (!id) return NextResponse.json({ error: "ID required" }, { status: 400 });

    const tx = await prisma.transaction.findUnique({ where: { id } });
    if (!tx || tx.userId !== session.user.id) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    if (await isLoanManagedTransaction(id, session.user.id)) {
      return NextResponse.json(
        { error: "Delete this entry from the Loans section" },
        { status: 409 }
      );
    }

    await prisma.transaction.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to delete transaction" },
      { status: 500 }
    );
  }
}

// PATCH /api/transactions
export async function PATCH(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { id, type, amount, category, account, note, date } = await req.json();
    if (!id) return NextResponse.json({ error: "ID required" }, { status: 400 });

    const tx = await prisma.transaction.findUnique({ where: { id } });
    if (!tx || tx.userId !== session.user.id) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    if (await isLoanManagedTransaction(id, session.user.id)) {
      return NextResponse.json(
        { error: "This entry is managed from the Loans section" },
        { status: 409 }
      );
    }

    const updated = await prisma.transaction.update({
      where: { id },
      data: {
        type,
        amount: parseFloat(amount),
        category,
        account: normalizeAccount(account),
        note,
        date: new Date(date),
      },
    });

    return NextResponse.json({ transaction: updated });
  } catch (error: unknown) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to update transaction" },
      { status: 500 }
    );
  }
}
