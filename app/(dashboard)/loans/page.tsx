import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import LoansDashboard from "@/components/LoansDashboard";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function LoansPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const loans = await prisma.loan.findMany({
    where: { userId: session.user.id },
    include: {
      payments: {
        orderBy: { date: "desc" },
      },
    },
    orderBy: { date: "desc" },
  });

  const formattedLoans = loans.map((loan) => ({
    id: loan.id,
    direction: loan.direction,
    personName: loan.personName,
    principal: loan.principal,
    interestRate: loan.interestRate,
    note: loan.note,
    status: loan.status,
    date: loan.date.toISOString(),
    payments: loan.payments.map((payment) => ({
      id: payment.id,
      amount: payment.amount,
      note: payment.note,
      date: payment.date.toISOString(),
    })),
  }));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="app-page-title">Loans</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Track loan given, loan taken, and every repayment separately from your income and expense ledger.
        </p>
      </div>

      <LoansDashboard initialLoans={formattedLoans} />
    </div>
  );
}
