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

  const transactions = await prisma.transaction.findMany({
    where: { userId },
    orderBy: { date: "desc" },
  });

  // Totals
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
    note: t.note,
    date: t.date.toISOString(),
  }));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="app-page-title">
          Expense Tracker
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Track your BDT income and expenses with full charts and history
        </p>
      </div>

      <ExpenseDashboard
        transactions={formattedTx}
        monthlyData={monthlyData}
        categoryData={categoryData}
        totalIncome={totalIncome}
        totalExpense={totalExpense}
      />
    </div>
  );
}
