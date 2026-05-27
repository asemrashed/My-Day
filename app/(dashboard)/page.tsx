import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import BalanceWidget from "@/components/BalanceWidget";
import TaskCheckbox from "@/components/TaskCheckbox";
import GoalsWidget from "@/components/GoalsWidget";
import NotesWidget from "@/components/NotesWidget";
import { formatBengaliDate, getTraditionalBengaliDate } from "@/lib/utils";
import { 
  ArrowRight, 
  CalendarDays,
  ShoppingBag,
  ListTodo
} from "lucide-react";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const session = await auth();
  const user = session?.user;
  
  if (!user?.id) return null;

  // Time based greeting
  const hour = new Date().getHours();
  let greeting = "Good morning";
  if (hour >= 12 && hour < 17) greeting = "Good afternoon";
  else if (hour >= 17 || hour < 4) greeting = "Good evening";

  const today = new Date();
  
  // Format English date
  const englishDate = today.toLocaleDateString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });
  
  // Format Bengali date
  const standardBengaliDate = formatBengaliDate(today);
  const traditionalBengaliDate = getTraditionalBengaliDate(today);

  // Fetch transactions for balance calculations
  const transactions = await prisma.transaction.findMany({
    where: { userId: user.id },
    orderBy: { date: "desc" },
  });

  const totalIncome = transactions
    .filter((t) => t.type === "INCOME")
    .reduce((sum, t) => sum + t.amount, 0);

  const totalExpense = transactions
    .filter((t) => t.type === "EXPENSE")
    .reduce((sum, t) => sum + t.amount, 0);

  // Fetch today's tasks
  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);

  const endOfToday = new Date();
  endOfToday.setHours(23, 59, 59, 999);

  const tasks = await prisma.task.findMany({
    where: {
      userId: user.id,
      OR: [
        {
          dueDate: {
            gte: startOfToday,
            lte: endOfToday,
          },
        },
        {
          status: "PENDING", // Pending tasks carry over
        },
      ],
    },
    orderBy: [{ status: "asc" }, { order: "asc" }],
  });

  const totalTasks = tasks.length;
  const completedTasks = tasks.filter((t) => t.status === "DONE").length;
  const taskProgress = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

  // Recent 5 transactions
  const recentTransactions = transactions.slice(0, 5);

  return (
    <div className="space-y-8 pb-10">
      {/* Dynamic Greetings & Localized Calendars */}
      <div className="app-card flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 p-6 sm:p-8 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-primary/10 rounded-full blur-3xl pointer-events-none"></div>
        <div className="relative">
          <h1 className="app-page-title">
            {greeting}, {user.name?.split(" ")[0] || "User"}
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            Welcome back! Here&apos;s a brief snapshot of your day today.
          </p>
        </div>

        {/* Date localization card */}
        <div className="app-panel flex items-center gap-4 px-5 py-3 relative">
          <CalendarDays className="h-8 w-8 text-primary shrink-0" />
          <div className="text-left text-xs sm:text-sm">
            <span className="font-semibold text-foreground block">{englishDate}</span>
            <span className="text-muted-foreground block mt-0.5">{standardBengaliDate}</span>
            <span className="text-primary font-medium block text-[11px] mt-0.5 uppercase tracking-wide">
              {traditionalBengaliDate}
            </span>
          </div>
        </div>
      </div>

      {/* Balance Snapshots */}
      <BalanceWidget
        income={totalIncome}
        expense={totalExpense}
      />

      {/* Goals & Notes overview */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        <GoalsWidget />
        <NotesWidget />
      </div>

      {/* Balance Snapshots */}
      <BalanceWidget
        income={totalIncome}
        expense={totalExpense}
      />

      {/* Goals & Notes overview */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        <GoalsWidget />
        <NotesWidget />
      </div>

      {/* Task progress summary and recent feeds */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Today's Task Card */}
        <div className="app-card lg:col-span-1 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-6">
              <h3 className="font-bold text-lg text-card-foreground">Today&apos;s Tasks</h3>
              <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-muted text-muted-foreground border border-border">
                {completedTasks} / {totalTasks} Completed
              </span>
            </div>

            {totalTasks === 0 ? (
              <div className="text-center py-8">
                <ListTodo className="h-12 w-12 mx-auto text-muted-foreground/20 mb-3" />
                <p className="text-sm font-medium text-muted-foreground">No tasks scheduled for today</p>
                <Link
                  href="/tasks"
                  className="app-link-primary text-xs mt-2 inline-flex items-center gap-1"
                >
                  Create one now <ArrowRight className="h-3 w-3" />
                </Link>
              </div>
            ) : (
              <div className="space-y-4">
                {/* Progress bar */}
                <div>
                  <div className="flex justify-between text-xs font-semibold text-muted-foreground mb-1">
                    <span>Task Completion</span>
                    <span>{taskProgress}%</span>
                  </div>
                  <div className="w-full h-2.5 bg-muted rounded-full overflow-hidden border border-border">
                    <div
                      className="h-full bg-primary rounded-full transition-all duration-500"
                      style={{ width: `${taskProgress}%` }}
                    ></div>
                  </div>
                </div>

                {/* Micro task list */}
                <div className="space-y-2 mt-4 max-h-[220px] overflow-y-auto pr-1">
                  {tasks.slice(0, 4).map((task) => (
                    <div
                      key={task.id}
                      className="flex items-center justify-between p-3 rounded-xl bg-muted/60 border border-border"
                    >
                      <div className="flex items-center gap-3 overflow-hidden">
                        <TaskCheckbox taskId={task.id} currentStatus={task.status} />
                        <span className={`text-xs truncate font-medium ${
                          task.status === "DONE" 
                            ? "line-through text-muted-foreground" 
                            : "text-foreground"
                        }`}>
                          {task.title}
                        </span>
                      </div>
                      
                      <span className={`text-[9px] font-extrabold uppercase px-1.5 py-0.5 rounded shrink-0 ${
                        task.priority === "HIGH" 
                          ? "bg-rose-950/20 text-rose-500 border border-rose-500/20" 
                          : task.priority === "MEDIUM"
                          ? "bg-amber-950/20 text-amber-500 border border-amber-500/20"
                          : "bg-primary/10 text-primary border border-primary/20"
                      }`}>
                        {task.priority}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
          
          <Link
            href="/tasks"
            className="w-full flex items-center justify-center gap-2 py-3 mt-6 border border-border rounded-2xl hover:bg-muted text-xs text-foreground font-semibold transition-all active:scale-[0.98]"
          >
            Manage Tasks
            <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>

        {/* Recent Activity Table (Tasks & Cashflows) */}
        <div className="app-card lg:col-span-2 flex flex-col justify-between">
          <div>
            <h3 className="font-bold text-lg text-card-foreground mb-6">
              Recent Financial Transactions
            </h3>

            {recentTransactions.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <ShoppingBag className="h-12 w-12 mx-auto text-muted-foreground/20 mb-3" />
                <p className="text-sm font-medium">No transactions recorded yet</p>
                <Link
                  href="/expenses"
                  className="app-link-primary text-xs mt-2 inline-flex items-center gap-1"
                >
                  Record an expense <ArrowRight className="h-3 w-3" />
                </Link>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-border pb-3">
                      <th className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider py-2">Category</th>
                      <th className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider py-2 hidden sm:table-cell">Note</th>
                      <th className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider py-2">Date</th>
                      <th className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider py-2 text-right">Amount</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {recentTransactions.map((tx) => (
                      <tr key={tx.id} className="hover:bg-muted/50 transition-all">
                        <td className="py-3 text-xs font-semibold text-foreground">
                          {tx.category}
                        </td>
                        <td className="py-3 text-xs text-muted-foreground max-w-[150px] truncate hidden sm:table-cell">
                          {tx.note || "-"}
                        </td>
                        <td className="py-3 text-xs text-muted-foreground">
                          {new Date(tx.date).toLocaleDateString([], {
                            month: "short",
                            day: "numeric",
                          })}
                        </td>
                        <td className={`py-3 text-xs font-bold text-right ${
                          tx.type === "INCOME" ? "text-income" : "text-expense"
                        }`}>
                          {tx.type === "INCOME" ? "+" : "-"}৳{tx.amount.toLocaleString("en-US", { minimumFractionDigits: 0 })}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          <Link
            href="/expenses"
            className="w-full flex items-center justify-center gap-2 py-3 mt-6 border border-border rounded-2xl hover:bg-muted text-xs text-foreground font-semibold transition-all active:scale-[0.98]"
          >
            Detailed Ledger & Charts
            <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>

      </div>
    </div>
  );
}
