"use client";

import { useState, useTransition } from "react";
import { createTransaction, deleteTransaction, updateTransaction } from "@/app/actions/transactions";
import IncomeExpenseBarChart from "@/components/Charts/BarChart";
import ExpensePieChart from "@/components/Charts/PieChart";
import {
  Plus, Search, Trash2, Edit2, X, TrendingUp, TrendingDown, DollarSign
} from "lucide-react";
import toast from "react-hot-toast";

const EXPENSE_CATEGORIES = [
  "🚌 Transport (Rickshaw, Bus, CNG, Uber, Pathao)",
  "🍛 Food (Meal, Tea, Snacks, Restaurant)",
  "🌐 Internet (Broadband, Mobile Data)",
  "🤖 AI Tools (Claude, ChatGPT, Copilot)",
  "☁️ Dev Tools (Domain, Hosting, Software)",
  "📱 Mobile Recharge",
  "🏠 Rent & Utilities",
  "👨‍👩‍👧 Family Support",
  "🏥 Healthcare",
  "📚 Learning (Courses, Books)",
  "💸 Miscellaneous",
];

const INCOME_CATEGORIES = ["Salary", "Freelance", "Side Project", "Other"];

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

interface ExpenseDashboardProps {
  transactions: Transaction[];
  monthlyData: MonthlyData[];
  categoryData: CategoryData[];
  totalIncome: number;
  totalExpense: number;
}

export default function ExpenseDashboard({
  transactions: initialTx,
  monthlyData,
  categoryData,
  totalIncome,
  totalExpense,
}: ExpenseDashboardProps) {
  const [transactions, setTransactions] = useState<Transaction[]>(initialTx);
  const [showForm, setShowForm] = useState(false);
  const [txType, setTxType] = useState("EXPENSE");
  const [amount, setAmount] = useState("");
  const [category, setCategory] = useState(EXPENSE_CATEGORIES[0]);
  const [note, setNote] = useState("");
  const [date, setDate] = useState(new Date().toISOString().split("T")[0]);
  const [search, setSearch] = useState("");
  const [filterType, setFilterType] = useState("all");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const balance = totalIncome - totalExpense;

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

  const filtered = transactions.filter((t) => {
    const matchesType = filterType === "all" || t.type === filterType;
    const matchesSearch =
      !search ||
      t.category.toLowerCase().includes(search.toLowerCase()) ||
      (t.note && t.note.toLowerCase().includes(search.toLowerCase()));
    return matchesType && matchesSearch;
  });

  const formatBDT = (n: number) => `৳${Math.abs(n).toLocaleString("en-US")}`;

  return (
    <div className="space-y-8">
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

      {/* Transaction Table */}
      <div className="app-card">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
          <h3 className="font-bold text-card-foreground text-lg">Transaction History</h3>
          <div className="flex gap-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <input
                type="text"
                placeholder="Search..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="app-input pl-9 pr-4 py-2 text-xs w-40"
              />
            </div>
            <select
              value={filterType}
              onChange={(e) => setFilterType(e.target.value)}
              className="px-3 py-2 bg-background border border-border rounded-xl text-foreground text-xs focus:outline-none focus:border-primary"
            >
              <option value="all">All</option>
              <option value="INCOME">Income</option>
              <option value="EXPENSE">Expense</option>
            </select>
            <button
              onClick={() => { setShowForm(!showForm); setEditingId(null); }}
              className="app-button-primary flex items-center gap-2 text-xs"
            >
              <Plus className="h-4 w-4" /> Add
            </button>
          </div>
        </div>

        {/* Add / Edit Form */}
        {showForm && (
          <div className="app-panel p-5 mb-6 animate-in fade-in slide-in-from-top-2 duration-200">
            <div className="flex justify-between items-center mb-4">
              <h4 className="text-sm font-bold text-foreground">{editingId ? "Edit Transaction" : "New Transaction"}</h4>
              <button onClick={resetForm} className="p-1 text-muted-foreground hover:text-foreground rounded">
                <X className="h-4 w-4" />
              </button>
            </div>
            <form onSubmit={handleSubmit} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              <div>
                <label className="text-[10px] uppercase font-bold text-muted-foreground block mb-1">Type</label>
                <div className="flex bg-muted p-0.5 rounded-xl">
                  {["EXPENSE", "INCOME"].map((t) => (
                    <button key={t} type="button" onClick={() => {
                      setTxType(t);
                      setCategory(t === "EXPENSE" ? EXPENSE_CATEGORIES[0] : INCOME_CATEGORIES[0]);
                    }}
                      className={`flex-1 py-2 rounded-lg text-xs font-semibold transition-all ${
                        txType === t
                          ? t === "INCOME" ? "bg-income text-white" : "bg-expense text-white"
                          : "text-muted-foreground"
                      }`}>
                      {t === "INCOME" ? "Income" : "Expense"}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="text-[10px] uppercase font-bold text-muted-foreground block mb-1">Amount (৳)</label>
                <input type="number" required min="0.01" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)}
                  placeholder="e.g. 2500"
                  className="app-input text-xs" />
              </div>

              <div>
                <label className="text-[10px] uppercase font-bold text-muted-foreground block mb-1">Category</label>
                <select value={category} onChange={(e) => setCategory(e.target.value)}
                  className="app-input text-xs">
                  {(txType === "EXPENSE" ? EXPENSE_CATEGORIES : INCOME_CATEGORIES).map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-[10px] uppercase font-bold text-muted-foreground block mb-1">Date</label>
                <input type="date" required value={date} onChange={(e) => setDate(e.target.value)}
                  className="app-input text-xs" />
              </div>

              <div>
                <label className="text-[10px] uppercase font-bold text-muted-foreground block mb-1">Note</label>
                <input type="text" value={note} onChange={(e) => setNote(e.target.value)}
                  placeholder="e.g. Rickshaw to office"
                  className="app-input text-xs" />
              </div>

              <div className="flex items-end">
                <button type="submit" disabled={isPending}
                  className={`w-full py-2.5 font-semibold text-white rounded-xl text-xs active:scale-95 transition-all flex items-center justify-center gap-2 ${
                    txType === "INCOME" ? "bg-income hover:bg-income/90" : "bg-expense hover:bg-expense/90"
                  }`}>
                  {isPending
                    ? <span className="h-4 w-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    : editingId ? "Save Changes" : "Record"}
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Table */}
        {filtered.length === 0 ? (
          <div className="text-center py-16 text-muted-foreground">
            <TrendingDown className="h-12 w-12 mx-auto opacity-10 mb-3" />
            <p className="text-sm font-medium">No transactions found</p>
          </div>
        ) : (
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
                {filtered.map((tx) => (
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
        )}
      </div>
    </div>
  );
}
