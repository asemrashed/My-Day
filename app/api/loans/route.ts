import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

async function getUserId() {
  const session = await auth();
  return session?.user?.id || null;
}

async function getOutstanding(loanId: string) {
  const loan = await prisma.loan.findUnique({
    where: { id: loanId },
    include: { payments: true },
  });
  if (!loan) return null;

  const paid = loan.payments.reduce((sum, payment) => sum + payment.amount, 0);
  return {
    loan,
    paid,
    outstanding: Math.max(loan.principal - paid, 0),
  };
}

export async function GET(req: NextRequest) {
  try {
    const userId = await getUserId();
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const status = new URL(req.url).searchParams.get("status");
    const where: { userId: string; status?: string } = { userId };
    if (status && status !== "all") where.status = status;

    const loans = await prisma.loan.findMany({
      where,
      include: { payments: { orderBy: { date: "desc" } } },
      orderBy: { date: "desc" },
    });

    return NextResponse.json({ loans });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Failed to fetch loans" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const userId = await getUserId();
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await req.json();

    if (body.loanId) {
      const amount = parseFloat(body.amount);
      const current = await getOutstanding(body.loanId);

      if (!current || current.loan.userId !== userId) {
        return NextResponse.json({ error: "Loan not found" }, { status: 404 });
      }
      if (Number.isNaN(amount) || amount <= 0) {
        return NextResponse.json({ error: "Payment must be a positive number" }, { status: 400 });
      }
      if (amount > current.outstanding) {
        return NextResponse.json({ error: "Payment cannot exceed outstanding balance" }, { status: 400 });
      }

      const payment = await prisma.loanPayment.create({
        data: {
          loanId: body.loanId,
          userId,
          amount,
          note: body.note || null,
          date: body.date ? new Date(body.date) : new Date(),
        },
      });

      if (amount >= current.outstanding) {
        await prisma.loan.update({ where: { id: body.loanId }, data: { status: "PAID" } });
      }

      return NextResponse.json({ payment }, { status: 201 });
    }

    const principal = parseFloat(body.principal);
    const interestRate = body.interestRate ? parseFloat(body.interestRate) : 0;

    if (body.direction !== "GIVEN" && body.direction !== "TAKEN") {
      return NextResponse.json({ error: "Loan direction is required" }, { status: 400 });
    }
    if (!body.personName || Number.isNaN(principal) || principal <= 0) {
      return NextResponse.json({ error: "Person name and principal are required" }, { status: 400 });
    }
    if (Number.isNaN(interestRate) || interestRate < 0) {
      return NextResponse.json({ error: "Interest rate cannot be negative" }, { status: 400 });
    }

    const loan = await prisma.loan.create({
      data: {
        userId,
        direction: body.direction,
        personName: body.personName,
        principal,
        interestRate,
        note: body.note || null,
        date: body.date ? new Date(body.date) : new Date(),
      },
      include: { payments: true },
    });

    return NextResponse.json({ loan }, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Failed to save loan" }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const userId = await getUserId();
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await req.json();
    const current = await getOutstanding(body.id);

    if (!current || current.loan.userId !== userId) {
      return NextResponse.json({ error: "Loan not found" }, { status: 404 });
    }

    const principal = parseFloat(body.principal);
    const interestRate = body.interestRate ? parseFloat(body.interestRate) : 0;

    if (Number.isNaN(principal) || principal <= 0 || principal < current.paid) {
      return NextResponse.json({ error: "Invalid principal" }, { status: 400 });
    }

    const loan = await prisma.loan.update({
      where: { id: body.id },
      data: {
        direction: body.direction,
        personName: body.personName,
        principal,
        interestRate,
        note: body.note || null,
        date: body.date ? new Date(body.date) : new Date(),
        status: principal <= current.paid ? "PAID" : "OPEN",
      },
      include: { payments: true },
    });

    return NextResponse.json({ loan });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Failed to update loan" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const userId = await getUserId();
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");
    const paymentId = searchParams.get("paymentId");

    if (paymentId) {
      const payment = await prisma.loanPayment.findUnique({
        where: { id: paymentId },
        include: { loan: true },
      });

      if (!payment || payment.userId !== userId || payment.loan.userId !== userId) {
        return NextResponse.json({ error: "Payment not found" }, { status: 404 });
      }

      await prisma.loanPayment.delete({ where: { id: paymentId } });
      await prisma.loan.update({ where: { id: payment.loanId }, data: { status: "OPEN" } });
      return NextResponse.json({ success: true });
    }

    if (!id) return NextResponse.json({ error: "ID required" }, { status: 400 });

    const loan = await prisma.loan.findUnique({ where: { id } });
    if (!loan || loan.userId !== userId) {
      return NextResponse.json({ error: "Loan not found" }, { status: 404 });
    }

    await prisma.loan.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Failed to delete loan" }, { status: 500 });
  }
}
