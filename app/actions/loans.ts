"use server";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";

async function getUserId() {
  const session = await auth();
  if (!session?.user?.id) {
    throw new Error("Unauthorized");
  }
  return session.user.id;
}

function parsePositiveNumber(value: FormDataEntryValue | null, label: string) {
  const amount = parseFloat(String(value || ""));
  if (Number.isNaN(amount) || amount <= 0) {
    throw new Error(`${label} must be a positive number`);
  }
  return amount;
}

const LOAN_TRANSACTION_CATEGORY = "Loan";

function getLoanTransactionType(direction: string) {
  return direction === "TAKEN" ? "INCOME" : "EXPENSE";
}

function getLoanTransactionNote(direction: string, personName: string, note: string) {
  const action = direction === "TAKEN" ? "Loan taken from" : "Loan given to";
  return [action, personName, note ? `- ${note}` : ""].filter(Boolean).join(" ");
}

async function getLoanOutstanding(loanId: string) {
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

export async function createLoan(formData: FormData) {
  try {
    const userId = await getUserId();
    const direction = String(formData.get("direction") || "");
    const personName = String(formData.get("personName") || "").trim();
    const principal = parsePositiveNumber(formData.get("principal"), "Principal");
    const interestRateRaw = String(formData.get("interestRate") || "0");
    const interestRate = interestRateRaw ? parseFloat(interestRateRaw) : 0;
    const note = String(formData.get("note") || "").trim();
    const dateStr = String(formData.get("date") || "");

    if (direction !== "GIVEN" && direction !== "TAKEN") {
      return { error: "Loan direction is required" };
    }
    if (!personName) {
      return { error: "Person name is required" };
    }
    if (Number.isNaN(interestRate) || interestRate < 0) {
      return { error: "Interest rate cannot be negative" };
    }

    const loanDate = dateStr ? new Date(dateStr) : new Date();
    const transaction = await prisma.transaction.create({
      data: {
        userId,
        type: getLoanTransactionType(direction),
        amount: principal,
        category: LOAN_TRANSACTION_CATEGORY,
        note: getLoanTransactionNote(direction, personName, note),
        date: loanDate,
      },
    });

    const loan = await prisma.loan.create({
      data: {
        userId,
        transactionId: transaction.id,
        direction,
        personName,
        principal,
        interestRate,
        note: note || null,
        date: loanDate,
      },
      include: { payments: true },
    });

    revalidatePath("/");
    revalidatePath("/expenses");
    revalidatePath("/loans");
    return { success: true, loan, transaction };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Failed to create loan" };
  }
}

export async function updateLoan(id: string, data: {
  direction: string;
  personName: string;
  principal: string;
  interestRate: string;
  note: string;
  date: string;
}) {
  try {
    const userId = await getUserId();
    const current = await getLoanOutstanding(id);

    if (!current || current.loan.userId !== userId) {
      return { error: "Loan not found" };
    }

    const principal = parsePositiveNumber(data.principal, "Principal");
    const interestRate = data.interestRate ? parseFloat(data.interestRate) : 0;

    if (data.direction !== "GIVEN" && data.direction !== "TAKEN") {
      return { error: "Loan direction is required" };
    }
    if (!data.personName.trim()) {
      return { error: "Person name is required" };
    }
    if (Number.isNaN(interestRate) || interestRate < 0) {
      return { error: "Interest rate cannot be negative" };
    }
    if (principal < current.paid) {
      return { error: "Principal cannot be less than recorded repayments" };
    }

    const loanDate = data.date ? new Date(data.date) : new Date();
    const transactionData = {
      type: getLoanTransactionType(data.direction),
      amount: principal,
      category: LOAN_TRANSACTION_CATEGORY,
      note: getLoanTransactionNote(data.direction, data.personName.trim(), data.note.trim()),
      date: loanDate,
    };
    let transactionId = current.loan.transactionId;
    let transaction = null;

    if (transactionId) {
      const existingTransaction = await prisma.transaction.findUnique({ where: { id: transactionId } });

      if (existingTransaction?.userId === userId) {
        transaction = await prisma.transaction.update({
          where: { id: transactionId },
          data: transactionData,
        });
      } else {
        transactionId = null;
      }
    }

    if (!transactionId) {
      transaction = await prisma.transaction.create({
        data: {
          userId,
          ...transactionData,
        },
      });
      transactionId = transaction.id;
    }

    const loan = await prisma.loan.update({
      where: { id },
      data: {
        transactionId,
        direction: data.direction,
        personName: data.personName.trim(),
        principal,
        interestRate,
        note: data.note.trim() || null,
        date: loanDate,
        status: principal <= current.paid ? "PAID" : "OPEN",
      },
      include: { payments: true },
    });

    revalidatePath("/");
    revalidatePath("/expenses");
    revalidatePath("/loans");
    return { success: true, loan, transaction };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Failed to update loan" };
  }
}

export async function deleteLoan(id: string) {
  try {
    const userId = await getUserId();
    const loan = await prisma.loan.findUnique({ where: { id } });

    if (!loan || loan.userId !== userId) {
      return { error: "Loan not found" };
    }

    await prisma.loan.delete({ where: { id } });
    if (loan.transactionId) {
      await prisma.transaction.deleteMany({
        where: { id: loan.transactionId, userId },
      });
    }

    revalidatePath("/");
    revalidatePath("/expenses");
    revalidatePath("/loans");
    return { success: true };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Failed to delete loan" };
  }
}

export async function createLoanPayment(formData: FormData) {
  try {
    const userId = await getUserId();
    const loanId = String(formData.get("loanId") || "");
    const amount = parsePositiveNumber(formData.get("amount"), "Payment");
    const note = String(formData.get("note") || "").trim();
    const dateStr = String(formData.get("date") || "");

    const current = await getLoanOutstanding(loanId);
    if (!current || current.loan.userId !== userId) {
      return { error: "Loan not found" };
    }
    if (amount > current.outstanding) {
      return { error: "Payment cannot exceed outstanding balance" };
    }

    const payment = await prisma.loanPayment.create({
      data: {
        loanId,
        userId,
        amount,
        note: note || null,
        date: dateStr ? new Date(dateStr) : new Date(),
      },
    });

    if (amount >= current.outstanding) {
      await prisma.loan.update({
        where: { id: loanId },
        data: { status: "PAID" },
      });
    }

    revalidatePath("/");
    revalidatePath("/expenses");
    revalidatePath("/loans");
    return { success: true, payment };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Failed to record repayment" };
  }
}

export async function deleteLoanPayment(id: string) {
  try {
    const userId = await getUserId();
    const payment = await prisma.loanPayment.findUnique({
      where: { id },
      include: { loan: true },
    });

    if (!payment || payment.userId !== userId || payment.loan.userId !== userId) {
      return { error: "Payment not found" };
    }

    await prisma.loanPayment.delete({ where: { id } });
    await prisma.loan.update({
      where: { id: payment.loanId },
      data: { status: "OPEN" },
    });

    revalidatePath("/");
    revalidatePath("/expenses");
    revalidatePath("/loans");
    return { success: true };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Failed to delete repayment" };
  }
}
