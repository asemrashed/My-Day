import { TrendingUp, TrendingDown, Landmark, HandCoins, Scale } from "lucide-react";

interface BalanceWidgetProps {
  income: number;
  expense: number;
  loanTaken: number;
  loanGiven: number;
  repaymentsOnTaken: number;
  repaymentsOnGiven: number;
  receivable: number;
  payable: number;
}

export default function BalanceWidget({
  income,
  expense,
  loanTaken,
  loanGiven,
  repaymentsOnTaken,
  repaymentsOnGiven,
  receivable,
  payable,
}: BalanceWidgetProps) {
  const balance = income - expense + loanTaken - loanGiven - repaymentsOnTaken + repaymentsOnGiven;
  const netWorth = balance + receivable - payable;
  const savingsPercent = income > 0 ? Math.max(0, Math.round((balance / income) * 100)) : 0;

  // Format currency helper
  const formatBDT = (amount: number) => {
    const isNegative = amount < 0;
    const absValue = Math.abs(amount);
    const formatted = absValue.toLocaleString("en-US", {
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    });
    return `${isNegative ? "-" : ""}৳ ${formatted}`;
  };

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-6 w-full mb-8">
      {/* Current Balance */}
      <div className="app-card relative overflow-hidden flex flex-col justify-between">
        <div className="absolute top-0 right-0 w-24 h-24 bg-primary/10 rounded-full blur-2xl"></div>
        <div className="flex items-center justify-between mb-4">
          <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
            Current Balance
          </span>
          <div className="p-2 rounded-xl bg-primary/10 text-primary border border-primary/20">
            <Landmark className="h-5 w-5" />
          </div>
        </div>
        <div>
          <h3 className={`text-2xl md:text-3xl font-bold tracking-tight ${
            balance >= 0 ? "text-income" : "text-expense"
          }`}>
            {formatBDT(balance)}
          </h3>
          <p className="text-xs text-muted-foreground mt-2">
            Net cash flow available
          </p>
        </div>
      </div>

      {/* Net Worth */}
      <div className="app-card relative overflow-hidden flex flex-col justify-between">
        <div className="absolute top-0 right-0 w-24 h-24 bg-primary/10 rounded-full blur-2xl"></div>
        <div className="flex items-center justify-between mb-4">
          <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
            Net Worth
          </span>
          <div className="p-2 rounded-xl bg-primary/10 text-primary border border-primary/20">
            <Scale className="h-5 w-5" />
          </div>
        </div>
        <div>
          <h3 className={`text-2xl md:text-3xl font-bold tracking-tight ${
            netWorth >= 0 ? "text-income" : "text-expense"
          }`}>
            {formatBDT(netWorth)}
          </h3>
          <p className="text-xs text-muted-foreground mt-2">
            Cash + receivable - payable
          </p>
        </div>
      </div>

      {/* Total Income */}
      <div className="app-card relative overflow-hidden flex flex-col justify-between">
        <div className="absolute top-0 right-0 w-24 h-24 bg-income/10 rounded-full blur-2xl"></div>
        <div className="flex items-center justify-between mb-4">
          <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
            Total Income
          </span>
          <div className="p-2 rounded-xl bg-income/10 text-income border border-income/20">
            <TrendingUp className="h-5 w-5" />
          </div>
        </div>
        <div>
          <h3 className="text-2xl md:text-3xl font-bold tracking-tight text-foreground">
            {formatBDT(income)}
          </h3>
          <p className="text-xs text-muted-foreground mt-2 flex items-center gap-1">
            <span className="text-income font-medium">All-time</span> cash inflows
          </p>
        </div>
      </div>

      {/* Total Expenses */}
      <div className="app-card relative overflow-hidden flex flex-col justify-between">
        <div className="absolute top-0 right-0 w-24 h-24 bg-expense/10 rounded-full blur-2xl"></div>
        <div className="flex items-center justify-between mb-4">
          <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
            Total Expenses
          </span>
          <div className="p-2 rounded-xl bg-expense/10 text-expense border border-expense/20">
            <TrendingDown className="h-5 w-5" />
          </div>
        </div>
        <div>
          <h3 className="text-2xl md:text-3xl font-bold tracking-tight text-foreground">
            {formatBDT(expense)}
          </h3>
          <p className="text-xs text-muted-foreground mt-2 flex items-center gap-1">
            <span className="text-expense font-medium">All-time</span> cash outflows
          </p>
        </div>
      </div>

      {/* Loan Receivable */}
      <div className="app-card relative overflow-hidden flex flex-col justify-between">
        <div className="absolute top-0 right-0 w-24 h-24 bg-income/10 rounded-full blur-2xl"></div>
        <div className="flex items-center justify-between mb-4">
          <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
            Loan Receivable
          </span>
          <div className="p-2 rounded-xl bg-income/10 text-income border border-income/20">
            <HandCoins className="h-5 w-5" />
          </div>
        </div>
        <div>
          <h3 className="text-2xl md:text-3xl font-bold tracking-tight text-income">
            {formatBDT(receivable)}
          </h3>
          <p className="text-xs text-muted-foreground mt-2">
            Outstanding money owed to you
          </p>
        </div>
      </div>

      {/* Loan Payable */}
      <div className="app-card relative overflow-hidden flex flex-col justify-between">
        <div className="absolute top-0 right-0 w-24 h-24 bg-expense/10 rounded-full blur-2xl"></div>
        <div className="flex items-center justify-between mb-4">
          <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
            Loan Payable
          </span>
          <div className="p-2 rounded-xl bg-expense/10 text-expense border border-expense/20">
            <HandCoins className="h-5 w-5" />
          </div>
        </div>
        <div>
          <h3 className="text-2xl md:text-3xl font-bold tracking-tight text-expense">
            {formatBDT(payable)}
          </h3>
          <p className="text-xs text-muted-foreground mt-2">
            Outstanding money you owe
          </p>
        </div>
      </div>

      {/* Savings Percentage */}
      <div className="app-card relative overflow-hidden flex flex-col justify-between">
        <div className="absolute top-0 right-0 w-24 h-24 bg-primary/10 rounded-full blur-2xl"></div>
        <div className="flex items-center justify-between mb-4">
          <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
            Savings Ratio
          </span>
          <div className="p-2 rounded-xl bg-primary/10 text-primary border border-primary/20">
            <Landmark className="h-5 w-5" />
          </div>
        </div>
        <div>
          <div className="flex items-end justify-between">
            <h3 className="text-2xl md:text-3xl font-bold tracking-tight text-primary">
              {savingsPercent}%
            </h3>
            <span className="text-xs text-muted-foreground mb-1">
              saved
            </span>
          </div>
          {/* Progress bar */}
          <div className="w-full h-2 bg-muted rounded-full mt-3 overflow-hidden">
            <div
              className="h-full bg-primary rounded-full transition-all duration-500"
              style={{ width: `${savingsPercent}%` }}
            ></div>
          </div>
        </div>
      </div>
    </div>
  );
}
