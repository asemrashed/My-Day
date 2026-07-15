"use client";

import { useState, useTransition, useMemo, useEffect } from "react";
import { createTransaction, deleteTransaction, updateTransaction } from "@/app/actions/transactions";
import {
  createLoan,
  createLoanPayment,
  deleteLoan,
  deleteLoanPayment,
  updateLoan,
} from "@/app/actions/loans";
import { getCategories, type CategoryItem } from "@/app/actions/categories";
import {
  DEFAULT_EXPENSE_CATEGORIES,
  DEFAULT_INCOME_CATEGORIES,
  type CategoryType,
} from "@/lib/categories";
import IncomeExpenseBarChart from "@/components/Charts/BarChart";
import ExpensePieChart from "@/components/Charts/PieChart";
import FormModal from "@/components/FormModal";
import CategorySelect from "@/components/CategorySelect";
import CategoryManager from "@/components/CategoryManager";
import DateInput from "@/components/DateInput";
import {
  Plus, Search, Trash2, Edit2, X, TrendingUp, TrendingDown, DollarSign,
  Banknote, HandCoins, ReceiptText, Pencil, Scale, ChevronLeft, ChevronRight
} from "lucide-react";
import toast from "react-hot-toast";

const PAGE_SIZE = 10;

interface Transaction {
  id: string;
  type: string;
  amount: number;
  category: string;
  note: string | null;
  date: string;
}

interface MonthlyData {
  month: string;
  income: number;
  expense: number;
}

interface CategoryData {
  name: string;
  value: number;
}

interface TransactionResult {
  transaction?: {
    id?: string;
  };
  error?: string;
}

interface LoanPayment {
  id: string;
  amount: number;
  note: string | null;
  date: string;
}

interface Loan {
  id: string;
  direction: string;
  personName: string;
  principal: number;
  interestRate: number;
  note: string | null;
  status: string;
  date: string;
  payments: LoanPayment[];
}

interface ExpenseDashboardProps {
  transactions: Transaction[];
  monthlyData: MonthlyData[];
  categoryData: CategoryData[];
  totalIncome: number;
  totalExpense: number;
  initialLoans: Loan[];
}

export default function ExpenseDashboard({
  transactions: initialTx,
  monthlyData,
  categoryData,
  totalIncome,
  totalExpense,
  initialLoans,
}: ExpenseDashboardProps) {
  // Navigation / Tabs
  const [activeTab, setActiveTab] = useState<"expenses" | "loans">("expenses");

  // Expenses State
  const [transactions, setTransactions] = useState<Transaction[]>(initialTx);
  const [showForm, setShowForm] = useState(false);
  const [txType, setTxType] = useState("EXPENSE");
  const [amount, setAmount] = useState("");
  const [expenseItems, setExpenseItems] = useState<CategoryItem[]>([]);
  const [incomeItems, setIncomeItems] = useState<CategoryItem[]>([]);
  const [expenseCategories, setExpenseCategories] = useState<string[]>([...DEFAULT_EXPENSE_CATEGORIES]);
  const [incomeCategories, setIncomeCategories] = useState<string[]>([...DEFAULT_INCOME_CATEGORIES]);
  const [category, setCategory] = useState<string>(DEFAULT_EXPENSE_CATEGORIES[0]);
  const [note, setNote] = useState("");
  const [date, setDate] = useState(new Date().toISOString().split("T")[0]);
  const [search, setSearch] = useState("");
  const [filterType, setFilterType] = useState("all");
  const [filterCategory, setFilterCategory] = useState("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [page, setPage] = useState(1);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    getCategories().then((res) => {
      if (res.expense) setExpenseCategories(res.expense);
      if (res.income) setIncomeCategories(res.income);
      if (res.items) {
        setExpenseItems(res.items.filter((i) => i.type === "EXPENSE"));
        setIncomeItems(res.items.filter((i) => i.type === "INCOME"));
      }
    });
  }, []);

  const activeCategories = txType === "EXPENSE" ? expenseCategories : incomeCategories;
  const allFilterCategories = useMemo(() => {
    const fromTx = Array.from(new Set(transactions.map((t) => t.category))).sort();
    const fromLists = Array.from(new Set([...expenseCategories, ...incomeCategories]));
    return Array.from(new Set([...fromLists, ...fromTx])).sort((a, b) => a.localeCompare(b));
  }, [transactions, expenseCategories, incomeCategories]);

  const handleCategoryAdded = (name: string, type: CategoryType, item?: CategoryItem) => {
    if (type === "EXPENSE") {
      setExpenseCategories((prev) => (prev.includes(name) ? prev : [...prev, name]));
      if (item) setExpenseItems((prev) => (prev.some((c) => c.id === item.id) ? prev : [...prev, item]));
    } else {
      setIncomeCategories((prev) => (prev.includes(name) ? prev : [...prev, name]));
      if (item) setIncomeItems((prev) => (prev.some((c) => c.id === item.id) ? prev : [...prev, item]));
    }
  };

  const handleCategoryDeleted = (name: string, type: CategoryType) => {
    if (type === "EXPENSE") {
      setExpenseCategories((prev) => prev.filter((c) => c !== name));
      setExpenseItems((prev) => prev.filter((c) => c.name !== name));
    } else {
      setIncomeCategories((prev) => prev.filter((c) => c !== name));
      setIncomeItems((prev) => prev.filter((c) => c.name !== name));
    }
    if (category === name) {
      setCategory(type === "EXPENSE" ? expenseCategories.find((c) => c !== name) || "" : incomeCategories.find((c) => c !== name) || "");
    }
    if (filterCategory === name) setFilterCategory("all");
  };

  const syncCategoriesFromManager = (next: { expenseItems: CategoryItem[]; incomeItems: CategoryItem[] }) => {
    setExpenseItems(next.expenseItems);
    setIncomeItems(next.incomeItems);
    setExpenseCategories(next.expenseItems.map((i) => i.name));
    setIncomeCategories(next.incomeItems.map((i) => i.name));
  };

  // Loans State
  const [loans, setLoans] = useState<Loan[]>(initialLoans);
  const [statusFilter, setStatusFilter] = useState("OPEN");
  const [showLoanForm, setShowLoanForm] = useState(false);
  const [editingLoanId, setEditingLoanId] = useState<string | null>(null);
  const [loanDirection, setLoanDirection] = useState("GIVEN");
  const [personName, setPersonName] = useState("");
  const [principal, setPrincipal] = useState("");
  const [interestRate, setInterestRate] = useState("0");
  const [loanNote, setLoanNote] = useState("");
  const [loanDate, setLoanDate] = useState(new Date().toISOString().split("T")[0]);
  const [paymentAmounts, setPaymentAmounts] = useState<Record<string, string>>({});
  const [paymentNotes, setPaymentNotes] = useState<Record<string, string>>({});
  const [paymentDates, setPaymentDates] = useState<Record<string, string>>({});

  const balance = totalIncome - totalExpense;

  // Loan Computations
  const getPaid = (loan: Loan) => loan.payments.reduce((sum, payment) => sum + payment.amount, 0);
  const getOutstanding = (loan: Loan) => Math.max(loan.principal - getPaid(loan), 0);

  const loanTotals = useMemo(() => {
    return loans.reduce(
      (acc, loan) => {
        const paid = getPaid(loan);
        const outstanding = getOutstanding(loan);

        if (loan.direction === "GIVEN") {
          acc.loanGiven += loan.principal;
          acc.repaymentsOnGiven += paid;
          acc.receivable += outstanding;
        } else {
          acc.loanTaken += loan.principal;
          acc.repaymentsOnTaken += paid;
          acc.payable += outstanding;
        }

        return acc;
      },
      {
        loanGiven: 0,
        loanTaken: 0,
        repaymentsOnGiven: 0,
        repaymentsOnTaken: 0,
        receivable: 0,
        payable: 0,
      }
    );
  }, [loans]);

  const filteredLoans = loans.filter((loan) => statusFilter === "all" || loan.status === statusFilter);

  // Expense Handlers
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!amount || parseFloat(amount) <= 0) {
      toast.error("Enter a valid amount");
      return;
    }

    startTransition(async () => {
      if (editingId) {
        const res = await updateTransaction(editingId, { type: txType, amount, category, note, date });
        if (res.success) {
          toast.success("Transaction updated!");
          setTransactions((prev) =>
            prev.map((t) => t.id === editingId ? { ...t, type: txType, amount: parseFloat(amount), category, note, date } : t)
          );
          resetForm();
        } else {
          toast.error(res.error || "Update failed");
        }
      } else {
        const formData = new FormData();
        formData.append("type", txType);
        formData.append("amount", amount);
        formData.append("category", category);
        formData.append("note", note);
        formData.append("date", date);

        const res = await createTransaction(formData);
        if (res.success && res.transaction) {
          const transactionResult = res as TransactionResult;
          toast.success("Transaction recorded!");
          const newTx: Transaction = {
            id: transactionResult.transaction?.id || crypto.randomUUID(),
            type: txType,
            amount: parseFloat(amount),
            category,
            note,
            date,
          };
          setTransactions((prev) => [newTx, ...prev]);
          resetForm();
        } else {
          toast.error((res as TransactionResult).error || "Failed to record");
        }
      }
    });
  };

  const resetForm = () => {
    setAmount("");
    setNote("");
    setDate(new Date().toISOString().split("T")[0]);
    setEditingId(null);
    setShowForm(false);
  };

  const startEdit = (tx: Transaction) => {
    setEditingId(tx.id);
    setTxType(tx.type);
    setAmount(String(tx.amount));
    setCategory(tx.category);
    setNote(tx.note || "");
    setDate(tx.date.slice(0, 10));
    setShowForm(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this transaction?")) return;
    const res = await deleteTransaction(id);
    if (res.success) {
      toast.success("Transaction deleted");
      setTransactions((prev) => prev.filter((t) => t.id !== id));
    } else {
      toast.error((res as TransactionResult).error || "Delete failed");
    }
  };

  // Loan Handlers
  const resetLoanForm = () => {
    setEditingLoanId(null);
    setLoanDirection("GIVEN");
    setPersonName("");
    setPrincipal("");
    setInterestRate("0");
    setLoanNote("");
    setLoanDate(new Date().toISOString().split("T")[0]);
    setShowLoanForm(false);
  };

  const startEditLoan = (loan: Loan) => {
    setEditingLoanId(loan.id);
    setLoanDirection(loan.direction);
    setPersonName(loan.personName);
    setPrincipal(String(loan.principal));
    setInterestRate(String(loan.interestRate));
    setLoanNote(loan.note || "");
    setLoanDate(loan.date.slice(0, 10));
    setShowLoanForm(true);
  };

  const handleLoanSubmit = (event: React.FormEvent) => {
    event.preventDefault();

    startTransition(async () => {
      if (editingLoanId) {
        const res = await updateLoan(editingLoanId, {
          direction: loanDirection,
          personName,
          principal,
          interestRate,
          note: loanNote,
          date: loanDate,
        });

        if (res.success && res.loan) {
          toast.success("Loan updated");
          setLoans((prev) =>
            prev.map((l) =>
              l.id === editingLoanId
                ? {
                    ...res.loan,
                    date: res.loan.date instanceof Date ? res.loan.date.toISOString() : String(res.loan.date),
                    payments: res.loan.payments.map((p) => ({
                      ...p,
                      date: p.date instanceof Date ? p.date.toISOString() : String(p.date),
                    })),
                  }
                : l
            )
          );
          resetLoanForm();
        } else {
          toast.error(res.error || "Failed to update loan");
        }
        return;
      }

      const formData = new FormData();
      formData.append("direction", loanDirection);
      formData.append("personName", personName);
      formData.append("principal", principal);
      formData.append("interestRate", interestRate);
      formData.append("note", loanNote);
      formData.append("date", loanDate);

      const res = await createLoan(formData);
      if (res.success && res.loan) {
        toast.success("Loan recorded");
        setLoans((prev) => [
          {
            ...res.loan,
            date: res.loan.date instanceof Date ? res.loan.date.toISOString() : String(res.loan.date),
            payments: [],
          },
          ...prev,
        ]);
        resetLoanForm();
      } else {
        toast.error(res.error || "Failed to create loan");
      }
    });
  };

  const handleDeleteLoan = (id: string) => {
    if (!confirm("Delete this loan and its repayments?")) return;

    startTransition(async () => {
      const res = await deleteLoan(id);
      if (res.success) {
        toast.success("Loan deleted");
        setLoans((prev) => prev.filter((l) => l.id !== id));
      } else {
        toast.error(res.error || "Failed to delete loan");
      }
    });
  };

  const handlePayment = (loan: Loan) => {
    startTransition(async () => {
      const formData = new FormData();
      formData.append("loanId", loan.id);
      formData.append("amount", paymentAmounts[loan.id] || "");
      formData.append("note", paymentNotes[loan.id] || "");
      formData.append("date", paymentDates[loan.id] || new Date().toISOString().split("T")[0]);

      const res = await createLoanPayment(formData);
      if (res.success && res.payment) {
        toast.success("Repayment recorded");
        const payment = {
          ...res.payment,
          date: res.payment.date instanceof Date ? res.payment.date.toISOString() : String(res.payment.date),
        };
        setLoans((prev) =>
          prev.map((item) => {
            if (item.id !== loan.id) return item;
            const payments = [payment, ...item.payments];
            const paid = payments.reduce((sum, entry) => sum + entry.amount, 0);
            return {
              ...item,
              payments,
              status: paid >= item.principal ? "PAID" : "OPEN",
            };
          })
        );
        setPaymentAmounts((prev) => ({ ...prev, [loan.id]: "" }));
        setPaymentNotes((prev) => ({ ...prev, [loan.id]: "" }));
      } else {
        toast.error(res.error || "Failed to record repayment");
      }
    });
  };

  const handleDeletePayment = (loanId: string, paymentId: string) => {
    startTransition(async () => {
      const res = await deleteLoanPayment(paymentId);
      if (res.success) {
        toast.success("Repayment deleted");
        setLoans((prev) =>
          prev.map((l) =>
            l.id === loanId
              ? {
                  ...l,
                  status: "OPEN",
                  payments: l.payments.filter((p) => p.id !== paymentId),
                }
              : l
          )
        );
      } else {
        toast.error(res.error || "Failed to delete repayment");
      }
    });
  };

  const filtered = useMemo(() => {
    return transactions.filter((t) => {
      const matchesType = filterType === "all" || t.type === filterType;
      const matchesCategory = filterCategory === "all" || t.category === filterCategory;
      const matchesSearch =
        !search ||
        t.category.toLowerCase().includes(search.toLowerCase()) ||
        (t.note && t.note.toLowerCase().includes(search.toLowerCase()));

      const txDay = t.date.slice(0, 10);
      const matchesFrom = !dateFrom || txDay >= dateFrom;
      const matchesTo = !dateTo || txDay <= dateTo;

      return matchesType && matchesCategory && matchesSearch && matchesFrom && matchesTo;
    });
  }, [transactions, filterType, filterCategory, search, dateFrom, dateTo]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const paginated = useMemo(() => {
    const start = (currentPage - 1) * PAGE_SIZE;
    return filtered.slice(start, start + PAGE_SIZE);
  }, [filtered, currentPage]);

  useEffect(() => {
    setPage(1);
  }, [filterType, filterCategory, search, dateFrom, dateTo]);

  const formatBDT = (n: number) => `৳${Math.abs(n).toLocaleString("en-US")}`;

  return (
    <div className="space-y-8">
      {/* Visual Navigation Tabs */}
      <div className="flex bg-slate-950/60 p-1 rounded-2xl border border-slate-800/80 max-w-md">
        <button
          onClick={() => setActiveTab("expenses")}
          className={`flex-1 flex items-center justify-center gap-2 py-3 px-4 rounded-xl text-xs font-bold transition-all active:scale-[0.98] ${
            activeTab === "expenses"
              ? "bg-primary text-white shadow-lg shadow-primary/20"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          <Scale className="h-4 w-4" />
          Expenses & Incomes
        </button>
        <button
          onClick={() => setActiveTab("loans")}
          className={`flex-1 flex items-center justify-center gap-2 py-3 px-4 rounded-xl text-xs font-bold transition-all active:scale-[0.98] ${
            activeTab === "loans"
              ? "bg-primary text-white shadow-lg shadow-primary/20"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          <HandCoins className="h-4 w-4" />
          Loans & Debts
        </button>
      </div>

      {activeTab === "expenses" && (
        <div className="space-y-8 animate-in fade-in duration-200">
          {/* Summary Cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {[
              { label: "Balance", value: balance, color: balance >= 0 ? "text-income" : "text-expense", icon: DollarSign, bg: "bg-primary/10" },
              { label: "Total Income", value: totalIncome, color: "text-income", icon: TrendingUp, bg: "bg-income/10" },
              { label: "Total Expense", value: totalExpense, color: "text-expense", icon: TrendingDown, bg: "bg-expense/10" },
              { label: "Savings %", value: totalIncome > 0 ? Math.max(0, Math.round((balance / totalIncome) * 100)) : 0, color: "text-primary", icon: DollarSign, bg: "bg-primary/10", isPercent: true },
            ].map(({ label, value, color, icon: Icon, bg, isPercent }) => (
              <div key={label} className="app-card p-5">
                <div className="flex justify-between items-center mb-3">
                  <span className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider">{label}</span>
                  <div className={`p-2 rounded-xl ${bg}`}>
                    <Icon className={`h-4 w-4 ${color}`} />
                  </div>
                </div>
                <p className={`text-xl font-extrabold ${color}`}>
                  {isPercent ? `${value}%` : formatBDT(value as number)}
                </p>
              </div>
            ))}
          </div>

          {/* Loan Given / Taken Overview */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {[
              { label: "Loan Receivable", value: loanTotals.receivable, color: "text-income", icon: HandCoins, bg: "bg-income/10" },
              { label: "Loan Payable", value: loanTotals.payable, color: "text-expense", icon: Banknote, bg: "bg-expense/10" },
              { label: "Total Given", value: loanTotals.loanGiven, color: "text-primary", icon: ReceiptText, bg: "bg-primary/10" },
              { label: "Total Taken", value: loanTotals.loanTaken, color: "text-primary", icon: Banknote, bg: "bg-primary/10" },
            ].map(({ label, value, color, icon: Icon, bg }) => (
              <div key={label} className="app-card p-5">
                <div className="flex justify-between items-center mb-3">
                  <span className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider">{label}</span>
                  <div className={`p-2 rounded-xl ${bg}`}>
                    <Icon className={`h-4 w-4 ${color}`} />
                  </div>
                </div>
                <p className={`text-xl font-extrabold ${color}`}>{formatBDT(value)}</p>
              </div>
            ))}
          </div>

          {/* Charts Row */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="app-card">
              <h3 className="font-bold text-card-foreground text-sm mb-4">Monthly Income vs Expenses</h3>
              <IncomeExpenseBarChart data={monthlyData} />
            </div>
            <div className="app-card">
              <h3 className="font-bold text-card-foreground text-sm mb-4">Expense Breakdown by Category</h3>
              <ExpensePieChart data={categoryData} />
            </div>
          </div>

          {/* Category Manager */}
          <CategoryManager
            expenseItems={expenseItems}
            incomeItems={incomeItems}
            onChange={syncCategoriesFromManager}
            onRenamed={(oldName, newName, type) => {
              setTransactions((prev) =>
                prev.map((t) =>
                  t.type === type && t.category === oldName ? { ...t, category: newName } : t
                )
              );
              if (category === oldName) setCategory(newName);
              if (filterCategory === oldName) setFilterCategory(newName);
            }}
          />

          {/* Transaction Table */}
          <div className="app-card">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 mb-4">
              <div>
                <h3 className="font-bold text-card-foreground text-lg">Transaction History</h3>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {filtered.length} result{filtered.length === 1 ? "" : "s"}
                  {filtered.length > 0 && (
                    <> · Page {currentPage} of {totalPages}</>
                  )}
                </p>
              </div>
              <button
                onClick={() => { resetForm(); setShowForm(true); }}
                className="app-button-primary flex items-center gap-2 text-xs self-start"
              >
                <Plus className="h-4 w-4" /> Add
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-5 gap-3 mb-6">
              <div className="relative xl:col-span-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <input
                  type="text"
                  placeholder="Search note / category..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="app-input pl-9 pr-4 py-2 text-xs w-full"
                />
              </div>
              <select
                value={filterType}
                onChange={(e) => setFilterType(e.target.value)}
                className="app-input py-2 text-xs"
              >
                <option value="all">All types</option>
                <option value="INCOME">Income</option>
                <option value="EXPENSE">Expense</option>
              </select>
              <select
                value={filterCategory}
                onChange={(e) => setFilterCategory(e.target.value)}
                className="app-input py-2 text-xs"
              >
                <option value="all">All categories</option>
                {allFilterCategories.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
              <DateInput
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                className="py-2 text-xs"
                title="From date"
              />
              <DateInput
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                className="py-2 text-xs"
                title="To date"
              />
            </div>

            {(filterType !== "all" || filterCategory !== "all" || search || dateFrom || dateTo) && (
              <div className="mb-4">
                <button
                  type="button"
                  onClick={() => {
                    setFilterType("all");
                    setFilterCategory("all");
                    setSearch("");
                    setDateFrom("");
                    setDateTo("");
                  }}
                  className="text-[11px] font-bold text-primary hover:underline"
                >
                  Clear filters
                </button>
              </div>
            )}

            {filtered.length === 0 ? (
              <div className="text-center py-16 text-muted-foreground">
                <TrendingDown className="h-12 w-12 mx-auto opacity-10 mb-3" />
                <p className="text-sm font-medium">No transactions found</p>
              </div>
            ) : (
              <>
                <div className="overflow-x-auto">
                  <table className="w-full text-left">
                    <thead>
                      <tr className="border-b border-slate-800">
                        {["Type", "Category", "Note", "Date", "Amount", ""].map((h) => (
                          <th key={h} className="pb-3 text-[10px] uppercase font-bold text-muted-foreground tracking-wider pr-4 last:pr-0">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/50">
                      {paginated.map((tx) => (
                        <tr key={tx.id} className="hover:bg-muted/50 transition-colors group">
                          <td className="py-3 pr-4">
                            <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full ${
                              tx.type === "INCOME"
                                ? "bg-income/10 text-income border border-income/20"
                                : "bg-expense/10 text-expense border border-expense/20"
                            }`}>
                              {tx.type === "INCOME" ? "IN" : "OUT"}
                            </span>
                          </td>
                          <td className="py-3 pr-4 text-xs font-medium text-foreground max-w-[160px] truncate">{tx.category}</td>
                          <td className="py-3 pr-4 text-xs text-muted-foreground max-w-[120px] truncate">{tx.note || "—"}</td>
                          <td className="py-3 pr-4 text-xs text-muted-foreground whitespace-nowrap">
                            {new Date(tx.date).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "2-digit" })}
                          </td>
                          <td className={`py-3 pr-4 text-sm font-extrabold whitespace-nowrap ${
                            tx.type === "INCOME" ? "text-income" : "text-expense"
                          }`}>
                            {tx.type === "INCOME" ? "+" : "−"}{formatBDT(tx.amount)}
                          </td>
                          <td className="py-3 text-right">
                            <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                              <button onClick={() => startEdit(tx)}
                                className="p-1.5 rounded-lg text-muted-foreground hover:text-primary hover:bg-muted active:scale-90 transition-all">
                                <Edit2 className="h-3.5 w-3.5" />
                              </button>
                              <button onClick={() => handleDelete(tx.id)}
                                className="p-1.5 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 active:scale-90 transition-all">
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {totalPages > 1 && (
                  <div className="flex items-center justify-between gap-3 mt-6 pt-4 border-t border-border/40">
                    <p className="text-[11px] text-muted-foreground">
                      Showing {(currentPage - 1) * PAGE_SIZE + 1}–
                      {Math.min(currentPage * PAGE_SIZE, filtered.length)} of {filtered.length}
                    </p>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        disabled={currentPage <= 1}
                        onClick={() => setPage((p) => Math.max(1, p - 1))}
                        className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl border border-border text-xs font-semibold hover:bg-muted disabled:opacity-40 disabled:cursor-not-allowed"
                      >
                        <ChevronLeft className="h-3.5 w-3.5" /> Prev
                      </button>
                      <span className="text-xs font-bold tabular-nums min-w-[3rem] text-center">
                        {currentPage}/{totalPages}
                      </span>
                      <button
                        type="button"
                        disabled={currentPage >= totalPages}
                        onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                        className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl border border-border text-xs font-semibold hover:bg-muted disabled:opacity-40 disabled:cursor-not-allowed"
                      >
                        Next <ChevronRight className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      )}

      {activeTab === "loans" && (
        <div className="space-y-8 animate-in fade-in duration-200">
          {/* Loan Grid Totals */}
          <div className="grid grid-cols-2 sm:grid-cols-2 xl:grid-cols-4 gap-4">
            {[
              { label: "Loan Receivable", value: loanTotals.receivable, icon: HandCoins, tone: "text-income" },
              { label: "Loan Payable", value: loanTotals.payable, icon: Banknote, tone: "text-expense" },
              { label: "Total Given", value: loanTotals.loanGiven, icon: ReceiptText, tone: "text-primary" },
              { label: "Total Taken", value: loanTotals.loanTaken, icon: Banknote, tone: "text-primary" },
            ].map(({ label, value, icon: Icon, tone }) => (
              <div key={label} className="app-card p-5">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">{label}</span>
                  <div className="rounded-xl border border-border bg-muted/60 p-2">
                    <Icon className={`h-4 w-4 ${tone}`} />
                  </div>
                </div>
                <p className={`mt-3 text-2xl font-extrabold ${tone}`}>{formatBDT(value)}</p>
              </div>
            ))}
          </div>

          {/* Loan Ledger Panel */}
          <div className="app-card">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="text-lg font-bold text-card-foreground">Loan Ledger</h2>
                <p className="text-sm text-muted-foreground">Track money you lent, borrowed, and repaid.</p>
              </div>

              <div className="flex flex-wrap gap-3">
                <select
                  value={statusFilter}
                  onChange={(event) => setStatusFilter(event.target.value)}
                  className="rounded-xl border border-border bg-background px-3 py-2 text-xs font-semibold text-foreground focus:border-primary focus:outline-none"
                >
                  <option value="OPEN">Open</option>
                  <option value="PAID">Paid</option>
                  <option value="all">All</option>
                </select>
                <button
                  onClick={() => {
                    resetLoanForm();
                    setShowLoanForm(true);
                  }}
                  className="app-button-primary flex items-center gap-2 text-xs"
                >
                  <Plus className="h-4 w-4" /> Add Loan
                </button>
              </div>
            </div>
          </div>

          {filteredLoans.length === 0 ? (
            <div className="app-card p-12 text-center text-muted-foreground">
              <HandCoins className="mx-auto mb-3 h-12 w-12 opacity-20" />
              <p className="text-sm font-semibold">No loans found</p>
            </div>
          ) : (
            <div className="space-y-4">
              {filteredLoans.map((loan) => {
                const paid = getPaid(loan);
                const outstanding = getOutstanding(loan);
                const paymentDate = paymentDates[loan.id] || new Date().toISOString().split("T")[0];

                return (
                  <div key={loan.id} className="app-card">
                    <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <span
                            className={`rounded-full border px-2 py-0.5 text-[10px] font-bold ${
                              loan.direction === "GIVEN"
                                ? "border-income/20 bg-income/10 text-income"
                                : "border-expense/20 bg-expense/10 text-expense"
                            }`}
                          >
                            {loan.direction === "GIVEN" ? "Given" : "Taken"}
                          </span>
                          <span className="rounded-full border border-border bg-muted px-2 py-0.5 text-[10px] font-bold text-muted-foreground">
                            {loan.status}
                          </span>
                          <span className="text-xs text-muted-foreground">{new Date(loan.date).toLocaleDateString()}</span>
                        </div>
                        <h3 className="mt-2 text-lg font-bold text-card-foreground">{loan.personName}</h3>
                        <p className="text-xs text-muted-foreground">{loan.note || "No note added"}</p>
                      </div>

                      <div className="grid grid-cols-3 gap-3 text-right text-xs">
                        <div>
                          <p className="text-muted-foreground">Principal</p>
                          <p className="font-bold text-foreground">{formatBDT(loan.principal)}</p>
                        </div>
                        <div>
                          <p className="text-muted-foreground">Paid</p>
                          <p className="font-bold text-primary">{formatBDT(paid)}</p>
                        </div>
                        <div>
                          <p className="text-muted-foreground">Outstanding</p>
                          <p className={`font-bold ${loan.direction === "GIVEN" ? "text-income" : "text-expense"}`}>{formatBDT(outstanding)}</p>
                        </div>
                      </div>
                    </div>

                    <div className="mt-5 grid grid-cols-1 gap-3 md:grid-cols-[1fr_1fr_1fr_auto]">
                      <input
                        className="app-input text-xs"
                        type="number"
                        min="0.01"
                        max={outstanding || undefined}
                        step="0.01"
                        disabled={outstanding === 0}
                        value={paymentAmounts[loan.id] || ""}
                        onChange={(event) => setPaymentAmounts((prev) => ({ ...prev, [loan.id]: event.target.value }))}
                        placeholder={outstanding > 0 ? "Repayment amount" : "Fully paid"}
                      />
                      <input
                        className="app-input text-xs"
                        disabled={outstanding === 0}
                        value={paymentNotes[loan.id] || ""}
                        onChange={(event) => setPaymentNotes((prev) => ({ ...prev, [loan.id]: event.target.value }))}
                        placeholder="Repayment note"
                      />
                      <DateInput
                        className="text-xs"
                        disabled={outstanding === 0}
                        value={paymentDate}
                        onChange={(event) => setPaymentDates((prev) => ({ ...prev, [loan.id]: event.target.value }))}
                      />
                      <button
                        disabled={isPending || outstanding === 0}
                        onClick={() => handlePayment(loan)}
                        className="app-button-primary flex items-center justify-center gap-2 text-xs disabled:cursor-not-allowed"
                      >
                        <ReceiptText className="h-4 w-4" /> Repay
                      </button>
                    </div>

                    {loan.payments.length > 0 && (
                      <div className="mt-4 divide-y divide-border rounded-2xl border border-border bg-muted/30">
                        {loan.payments.map((payment) => (
                          <div key={payment.id} className="flex items-center justify-between gap-3 px-4 py-3 text-xs">
                            <div>
                              <p className="font-semibold text-foreground">{formatBDT(payment.amount)}</p>
                              <p className="text-muted-foreground">
                                {new Date(payment.date).toLocaleDateString()} {payment.note ? `- ${payment.note}` : ""}
                              </p>
                            </div>
                            <button
                              onClick={() => handleDeletePayment(loan.id, payment.id)}
                              className="rounded-lg p-1.5 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                              title="Delete repayment"
                            >
                              <X className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}

                    <div className="mt-4 flex justify-end gap-2">
                      <button onClick={() => startEditLoan(loan)} className="rounded-lg p-2 text-muted-foreground hover:bg-muted hover:text-primary" title="Edit loan">
                        <Pencil className="h-4 w-4" />
                      </button>
                      <button onClick={() => handleDeleteLoan(loan.id)} className="rounded-lg p-2 text-muted-foreground hover:bg-destructive/10 hover:text-destructive" title="Delete loan">
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      <FormModal
        open={showForm}
        onClose={resetForm}
        title={editingId ? "Edit Transaction" : "New Transaction"}
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="text-[10px] uppercase font-bold text-muted-foreground block mb-1">Type</label>
            <div className="flex bg-muted p-0.5 rounded-xl">
              {["EXPENSE", "INCOME"].map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => {
                    setTxType(t);
                    setCategory(
                      t === "EXPENSE" ? expenseCategories[0] : incomeCategories[0]
                    );
                  }}
                  className={`flex-1 py-2 rounded-lg text-xs font-semibold transition-all ${
                    txType === t
                      ? t === "INCOME"
                        ? "bg-income text-white"
                        : "bg-expense text-white"
                      : "text-muted-foreground"
                  }`}
                >
                  {t === "INCOME" ? "Income" : "Expense"}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="text-[10px] uppercase font-bold text-muted-foreground block mb-1">Amount (৳)</label>
            <input
              type="number"
              required
              min="0.01"
              step="0.01"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="e.g. 2500"
              className="app-input text-xs"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <CategorySelect
              type={txType as CategoryType}
              value={category}
              options={activeCategories}
              onChange={setCategory}
              onCategoryAdded={handleCategoryAdded}
              onCategoryDeleted={handleCategoryDeleted}
            />
            <div>
              <label className="text-[10px] uppercase font-bold text-muted-foreground block mb-1">Date</label>
              <DateInput
                required
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="text-xs"
              />
            </div>
          </div>

          <div>
            <label className="text-[10px] uppercase font-bold text-muted-foreground block mb-1">Note</label>
            <input
              type="text"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="e.g. Rickshaw to office"
              className="app-input text-xs"
            />
          </div>

          <button
            type="submit"
            disabled={isPending}
            className={`w-full py-2.5 font-semibold text-white rounded-xl text-xs active:scale-95 transition-all flex items-center justify-center gap-2 ${
              txType === "INCOME" ? "bg-income hover:bg-income/90" : "bg-expense hover:bg-expense/90"
            }`}
          >
            {isPending ? (
              <span className="h-4 w-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
            ) : editingId ? (
              "Save Changes"
            ) : (
              "Record"
            )}
          </button>
        </form>
      </FormModal>

      <FormModal
        open={showLoanForm}
        onClose={resetLoanForm}
        title={editingLoanId ? "Edit Loan" : "Record Loan"}
      >
        <form onSubmit={handleLoanSubmit} className="space-y-4">
          <div>
            <label className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
              Direction
            </label>
            <div className="flex rounded-xl bg-muted p-0.5">
              {["GIVEN", "TAKEN"].map((item) => (
                <button
                  key={item}
                  type="button"
                  onClick={() => setLoanDirection(item)}
                  className={`flex-1 rounded-lg py-2 text-xs font-bold transition-colors ${
                    loanDirection === item
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {item === "GIVEN" ? "Given" : "Taken"}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
              Person
            </label>
            <input
              className="app-input text-xs"
              required
              value={personName}
              onChange={(event) => setPersonName(event.target.value)}
              placeholder="Name"
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                Principal
              </label>
              <input
                className="app-input text-xs"
                required
                min="0.01"
                step="0.01"
                type="number"
                value={principal}
                onChange={(event) => setPrincipal(event.target.value)}
                placeholder="5000"
              />
            </div>
            <div>
              <label className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                Interest %
              </label>
              <input
                className="app-input text-xs"
                min="0"
                step="0.01"
                type="number"
                value={interestRate}
                onChange={(event) => setInterestRate(event.target.value)}
              />
            </div>
          </div>
          <div>
            <label className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
              Date
            </label>
            <DateInput
              className="text-xs"
              value={loanDate}
              onChange={(event) => setLoanDate(event.target.value)}
            />
          </div>
          <div>
            <label className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
              Note
            </label>
            <input
              className="app-input text-xs"
              value={loanNote}
              onChange={(event) => setLoanNote(event.target.value)}
              placeholder="Optional"
            />
          </div>
          <button type="submit" disabled={isPending} className="app-button-primary w-full text-xs py-2.5">
            {editingLoanId ? "Save Loan" : "Record Loan"}
          </button>
        </form>
      </FormModal>
    </div>
  );
}
