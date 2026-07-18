import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import ExpenseDashboard from "@/components/ExpenseDashboard";
import { format, subMonths, startOfMonth, endOfMonth } from "date-fns";

export const dynamic = "force-dynamic";

export default async function ExpensesPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const userId = session.user.id;

  // Fetch transactions
  const transactions = await prisma.transaction.findMany({
    where: { userId },
    orderBy: { date: "desc" },
  });

  // Fetch loans
  const loans = await prisma.loan.findMany({
    where: { userId },
    include: {
      payments: {
        orderBy: { date: "desc" },
      },
    },
    orderBy: { date: "desc" },
  });

  // Totals for transactions
  const totalIncome = transactions.filter((t) => t.type === "INCOME").reduce((s, t) => s + t.amount, 0);
  const totalExpense = transactions.filter((t) => t.type === "EXPENSE").reduce((s, t) => s + t.amount, 0);

  // Build monthly chart data for last 6 months
  const monthlyData = [];
  for (let i = 5; i >= 0; i--) {
    const d = subMonths(new Date(), i);
    const start = startOfMonth(d);
    const end = endOfMonth(d);
    const monthTx = transactions.filter((t) => {
      const txDate = new Date(t.date);
      return txDate >= start && txDate <= end;
    });
    monthlyData.push({
      month: format(d, "MMM yy"),
      income: monthTx.filter((t) => t.type === "INCOME").reduce((s, t) => s + t.amount, 0),
      expense: monthTx.filter((t) => t.type === "EXPENSE").reduce((s, t) => s + t.amount, 0),
    });
  }

  // Category breakdown (expenses only)
  const categoryMap: Record<string, number> = {};
  transactions
    .filter((t) => t.type === "EXPENSE")
    .forEach((t) => {
      categoryMap[t.category] = (categoryMap[t.category] || 0) + t.amount;
    });

  const categoryData = Object.entries(categoryMap)
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value);

  const formattedTx = transactions.map((t) => ({
    id: t.id,
    type: t.type,
    amount: t.amount,
    category: t.category,
    account: t.account || "CASH",
    note: t.note,
    date: t.date.toISOString(),
  }));

  const formattedLoans = loans.map((loan) => ({
    id: loan.id,
    transactionId: loan.transactionId,
    direction: loan.direction,
    personName: loan.personName,
    principal: loan.principal,
    account: loan.account || "CASH",
    interestRate: loan.interestRate,
    note: loan.note,
    status: loan.status,
    date: loan.date.toISOString(),
    payments: loan.payments.map((payment) => ({
      id: payment.id,
      transactionId: payment.transactionId,
      amount: payment.amount,
      account: payment.account || "CASH",
      note: payment.note,
      date: payment.date.toISOString(),
    })),
  }));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="app-page-title">
          Financial Control Hub
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Track your incomes, expenses, investments, debts, and loans all in one place.
        </p>
      </div>

      <ExpenseDashboard
        transactions={formattedTx}
        monthlyData={monthlyData}
        categoryData={categoryData}
        totalIncome={totalIncome}
        totalExpense={totalExpense}
        initialLoans={formattedLoans}
      />
    </div>
  );
}
