"use client";

import { useState, useTransition, useEffect } from "react";
import { createTransaction } from "@/app/actions/transactions";
import { getCategories } from "@/app/actions/categories";
import {
  DEFAULT_EXPENSE_CATEGORIES,
  DEFAULT_INCOME_CATEGORIES,
  type CategoryType,
} from "@/lib/categories";
import CategorySelect from "@/components/CategorySelect";
import DateInput from "@/components/DateInput";
import { ACCOUNT_METHODS } from "@/lib/finance";
import { Plus, X, CheckSquare, DollarSign, Target, FileText } from "lucide-react";
import toast from "react-hot-toast";
import TaskForm from "@/components/TaskForm";
import { useGoalOptions, useInvalidateAppQueries } from "@/hooks/useAppQueries";

const noteCategories = ["Inbox", "Personal", "Work", "Finance", "Dev", "Other"];

export default function QuickAddModal() {
  const [isOpen, setIsOpen] = useState(false);
  const [activeModal, setActiveModal] = useState<"none" | "task" | "transaction" | "goal" | "note">("none");
  const [isPending, startTransition] = useTransition();
  const { data: taskGoals = [] } = useGoalOptions();
  const { invalidateGoals, invalidateNotes, invalidateTransactions, invalidateTasks } = useInvalidateAppQueries();

  // Transaction form states
  const [txType, setTxType] = useState("EXPENSE");
  const [txAmount, setTxAmount] = useState("");
  const [expenseCategories, setExpenseCategories] = useState<string[]>([...DEFAULT_EXPENSE_CATEGORIES]);
  const [incomeCategories, setIncomeCategories] = useState<string[]>([...DEFAULT_INCOME_CATEGORIES]);
  const [txCategory, setTxCategory] = useState<string>(DEFAULT_EXPENSE_CATEGORIES[0]);
  const [txAccount, setTxAccount] = useState("CASH");
  const [txNote, setTxNote] = useState("");
  const [txDate, setTxDate] = useState(new Date().toISOString().split("T")[0]);

  // Goal form states
  const [goalTitle, setGoalTitle] = useState("");
  const [goalPeriod, setGoalPeriod] = useState("MONTHLY");
  const [goalDueDate, setGoalDueDate] = useState("");
  const [goalDesc, setGoalDesc] = useState("");

  // Note form states
  const [noteTitle, setNoteTitle] = useState("");
  const [noteContent, setNoteContent] = useState("");
  const [noteCategory, setNoteCategory] = useState("Inbox");

  useEffect(() => {
    getCategories().then((res) => {
      if (res.expense) setExpenseCategories(res.expense);
      if (res.income) setIncomeCategories(res.income);
    });
  }, []);

  const handleCategoryAdded = (name: string, type: CategoryType) => {
    if (type === "EXPENSE") {
      setExpenseCategories((prev) => (prev.includes(name) ? prev : [...prev, name]));
    } else {
      setIncomeCategories((prev) => (prev.includes(name) ? prev : [...prev, name]));
    }
  };

  const handleCategoryDeleted = (name: string, type: CategoryType) => {
    if (type === "EXPENSE") {
      setExpenseCategories((prev) => prev.filter((c) => c !== name));
      if (txCategory === name) setTxCategory(expenseCategories.find((c) => c !== name) || "");
    } else {
      setIncomeCategories((prev) => prev.filter((c) => c !== name));
      if (txCategory === name) setTxCategory(incomeCategories.find((c) => c !== name) || "");
    }
  };

  const handleTxSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!txAmount || parseFloat(txAmount) <= 0) {
      toast.error("Please enter a valid amount");
      return;
    }

    startTransition(async () => {
      const formData = new FormData();
      formData.append("type", txType);
      formData.append("amount", txAmount);
      formData.append("category", txCategory);
      formData.append("account", txAccount);
      formData.append("note", txNote);
      formData.append("date", txDate);

      const res = await createTransaction(formData);
      if (res.success) {
        toast.success(`${txType === "INCOME" ? "Income" : "Expense"} added successfully!`);
        void invalidateTransactions();
        // Reset and close
        setTxAmount("");
        setTxAccount("CASH");
        setTxNote("");
        setTxDate(new Date().toISOString().split("T")[0]);
        setActiveModal("none");
        setIsOpen(false);
      } else {
        toast.error(res.error || "Failed to add transaction");
      }
    });
  };

  const handleGoalSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!goalTitle.trim()) {
      toast.error("Goal title is required");
      return;
    }

    startTransition(async () => {
      try {
        const res = await fetch("/api/goals", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            title: goalTitle.trim(),
            period: goalPeriod,
            dueDate: goalDueDate || null,
            description: JSON.stringify({
              text: goalDesc.trim(),
              checklist: [],
              links: [],
              images: [],
            }),
          }),
        });

        if (res.ok) {
          toast.success("Goal created successfully!");
          void invalidateGoals();
          setGoalTitle("");
          setGoalPeriod("MONTHLY");
          setGoalDueDate("");
          setGoalDesc("");
          setActiveModal("none");
          setIsOpen(false);
        } else {
          toast.error("Failed to create goal");
        }
      } catch {
        toast.error("Failed to create goal");
      }
    });
  };

  const handleNoteSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!noteTitle.trim() && !noteContent.trim()) {
      toast.error("Please enter a title or note content");
      return;
    }

    startTransition(async () => {
      try {
        const content = noteContent.trim()
          ? `<p>${noteContent.trim().replace(/\n/g, "<br>")}</p>`
          : "<p></p>";

        const res = await fetch("/api/notes", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            title: noteTitle.trim() || "Untitled Note",
            content,
            attachments: [noteCategory],
          }),
        });

        if (res.ok) {
          toast.success("Note created successfully!");
          void invalidateNotes();
          setNoteTitle("");
          setNoteContent("");
          setNoteCategory("Inbox");
          setActiveModal("none");
          setIsOpen(false);
        } else {
          toast.error("Failed to create note");
        }
      } catch {
        toast.error("Failed to create note");
      }
    });
  };

  return (
    <div className="fixed bottom-8 right-6 z-50">
      {/* Trigger floating button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`h-14 w-14 rounded-full flex items-center justify-center text-white font-bold shadow-2xl transition-all duration-300 active:scale-90 ${
          isOpen
            ? "bg-rose-500 rotate-45 hover:bg-rose-600 shadow-rose-900/30"
            : "bg-primary text-primary-foreground hover:bg-primary/90 shadow-primary/30 hover:scale-105"
        }`}
        aria-label="Quick Actions"
      >
        <Plus className="h-7 w-7" />
      </button>

      {/* Radial action buttons overlay */}
      {isOpen && activeModal === "none" && (
        <div className="absolute bottom-16 right-0 space-y-3 animate-in fade-in slide-in-from-bottom-5 duration-200">
          {/* Quick Expense Button */}
          <button
            onClick={() => {
              setActiveModal("transaction");
              setTxCategory(
                txType === "INCOME" ? incomeCategories[0] : expenseCategories[0]
              );
            }}
            className="flex items-center gap-3 px-4 py-2.5 rounded-xl bg-card border border-border text-card-foreground hover:bg-muted font-semibold shadow-xl active:scale-95 transition-all text-xs"
          >
            <DollarSign className="h-4 w-4 text-primary" />
            Add Expense/Income
          </button>

          {/* Quick Task Button */}
          <button
            onClick={() => setActiveModal("task")}
            className="flex items-center gap-3 px-4 py-2.5 rounded-xl bg-card border border-border text-card-foreground hover:bg-muted font-semibold shadow-xl active:scale-95 transition-all text-xs"
          >
            <CheckSquare className="h-4 w-4 text-primary" />
            Add New Task
          </button>

          {/* Quick Goal Button */}
          <button
            onClick={() => setActiveModal("goal")}
            className="flex items-center gap-3 px-4 py-2.5 rounded-xl bg-card border border-border text-card-foreground hover:bg-muted font-semibold shadow-xl active:scale-95 transition-all text-xs"
          >
            <Target className="h-4 w-4 text-primary" />
            Add Goal
          </button>

          {/* Quick Note Button */}
          <button
            onClick={() => setActiveModal("note")}
            className="flex items-center gap-3 px-4 py-2.5 rounded-xl bg-card border border-border text-card-foreground hover:bg-muted font-semibold shadow-xl active:scale-95 transition-all text-xs"
          >
            <FileText className="h-4 w-4 text-primary" />
            Add Notes
          </button>
        </div>
      )}

      {/* Modal Dialog container */}
      {isOpen && activeModal !== "none" && (
        <div className="fixed inset-0 bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="app-card w-full max-w-lg p-6 sm:p-8 relative animate-in zoom-in-95 duration-200">
            {/* Close Button */}
            <button
              onClick={() => {
                setActiveModal("none");
                setIsOpen(false);
              }}
              className="absolute top-4 right-4 p-2 rounded-xl text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
            >
              <X className="h-5 w-5" />
            </button>

            {/* Render Task Form */}
            {activeModal === "task" && (
              <div className="space-y-4">
                <h3 className="text-xl font-bold text-card-foreground">Create New Task</h3>
                <TaskForm
                  goals={taskGoals}
                  onSuccess={() => {
                    window.dispatchEvent(new Event("tasks:changed"));
                    void invalidateTasks();
                    setActiveModal("none");
                    setIsOpen(false);
                  }}
                />
              </div>
            )}

            {/* Render Transaction Form */}
            {activeModal === "transaction" && (
              <form onSubmit={handleTxSubmit} className="space-y-4">
                <h3 className="text-xl font-bold text-card-foreground mb-2">Record Transaction</h3>

                <div>
                  <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block mb-1">
                    Type
                  </label>
                  <div className="grid grid-cols-2 gap-3 bg-muted p-1 rounded-xl">
                    <button
                      type="button"
                      onClick={() => {
                        setTxType("EXPENSE");
                        setTxCategory(expenseCategories[0]);
                      }}
                      className={`py-2 rounded-lg font-semibold text-xs transition-all ${
                        txType === "EXPENSE"
                          ? "bg-expense text-white shadow"
                          : "text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      Expense
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setTxType("INCOME");
                        setTxCategory(incomeCategories[0]);
                      }}
                      className={`py-2 rounded-lg font-semibold text-xs transition-all ${
                        txType === "INCOME"
                          ? "bg-income text-white shadow"
                          : "text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      Income
                    </button>
                  </div>
                </div>

                <div>
                  <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block mb-1">
                    Amount (৳ BDT)
                  </label>
                  <input
                    type="number"
                    required
                    step="0.01"
                    min="0.01"
                    value={txAmount}
                    onChange={(e) => setTxAmount(e.target.value)}
                    placeholder="e.g. 1500"
                    className="app-input px-4 py-2.5 font-medium"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <CategorySelect
                    type={txType as CategoryType}
                    value={txCategory}
                    options={txType === "EXPENSE" ? expenseCategories : incomeCategories}
                    onChange={setTxCategory}
                    onCategoryAdded={handleCategoryAdded}
                    onCategoryDeleted={handleCategoryDeleted}
                  />
                  <div>
                    <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block mb-1">
                      Account
                    </label>
                    <select
                      value={txAccount}
                      onChange={(event) => setTxAccount(event.target.value)}
                      className="app-input px-4 py-2.5 text-sm"
                    >
                      {ACCOUNT_METHODS.map((method) => (
                        <option key={method.value} value={method.value}>{method.label}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block mb-1">
                      Transaction Date
                    </label>
                    <DateInput
                      required
                      value={txDate}
                      onChange={(e) => setTxDate(e.target.value)}
                      className="px-4 py-2.5 text-sm"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block mb-1">
                    Note (Optional)
                  </label>
                  <input
                    type="text"
                    value={txNote}
                    onChange={(e) => setTxNote(e.target.value)}
                    placeholder="e.g. Paid for rickshaw, team lunch, domain renewal"
                    className="app-input px-4 py-2.5 text-sm"
                  />
                </div>

                <button
                  type="submit"
                  disabled={isPending}
                  className={`w-full py-3 px-4 text-white font-semibold rounded-xl active:scale-95 transition-all flex items-center justify-center gap-2 disabled:opacity-50 mt-4 ${
                    txType === "EXPENSE" ? "bg-expense hover:bg-expense/90" : "bg-income hover:bg-income/90"
                  }`}
                >
                  {isPending ? (
                    <span className="h-5 w-5 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                  ) : (
                    `Record ${txType === "INCOME" ? "Income" : "Expense"}`
                  )}
                </button>
              </form>
            )}

            {/* Render Goal Form */}
            {activeModal === "goal" && (
              <form onSubmit={handleGoalSubmit} className="space-y-4">
                <h3 className="text-xl font-bold text-card-foreground mb-2">Create New Goal</h3>

                <div>
                  <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block mb-1">
                    Goal Title
                  </label>
                  <input
                    type="text"
                    required
                    value={goalTitle}
                    onChange={(e) => setGoalTitle(e.target.value)}
                    placeholder="e.g. Learn full-stack development"
                    className="app-input px-4 py-2.5"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block mb-1">
                      Period
                    </label>
                    <select
                      value={goalPeriod}
                      onChange={(e) => setGoalPeriod(e.target.value)}
                      className="app-input px-4 py-2.5 text-sm"
                    >
                      <option value="DAILY">Daily</option>
                      <option value="WEEKLY">Weekly</option>
                      <option value="MONTHLY">Monthly</option>
                      <option value="YEARLY">Yearly</option>
                      <option value="CUSTOM">Custom</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block mb-1">
                      Target Date
                    </label>
                    <DateInput
                      value={goalDueDate}
                      onChange={(e) => setGoalDueDate(e.target.value)}
                      className="px-4 py-2.5 text-sm"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block mb-1">
                    Description (Optional)
                  </label>
                  <textarea
                    value={goalDesc}
                    onChange={(e) => setGoalDesc(e.target.value)}
                    placeholder="Describe what you want to achieve..."
                    rows={3}
                    className="app-input px-4 py-2.5 resize-none"
                  />
                </div>

                <button
                  type="submit"
                  disabled={isPending}
                  className="app-button-primary w-full py-3 px-4 flex items-center justify-center gap-2 mt-4"
                >
                  {isPending ? (
                    <span className="h-5 w-5 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                  ) : (
                    "Create Goal"
                  )}
                </button>
              </form>
            )}

            {/* Render Note Form */}
            {activeModal === "note" && (
              <form onSubmit={handleNoteSubmit} className="space-y-4">
                <h3 className="text-xl font-bold text-card-foreground mb-2">Create New Note</h3>

                <div>
                  <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block mb-1">
                    Title
                  </label>
                  <input
                    type="text"
                    value={noteTitle}
                    onChange={(e) => setNoteTitle(e.target.value)}
                    placeholder="e.g. Meeting notes"
                    className="app-input px-4 py-2.5"
                  />
                </div>

                <div>
                  <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block mb-1">
                    Category
                  </label>
                  <select
                    value={noteCategory}
                    onChange={(e) => setNoteCategory(e.target.value)}
                    className="app-input px-4 py-2.5 text-sm"
                  >
                    {noteCategories.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block mb-1">
                    Content
                  </label>
                  <textarea
                    value={noteContent}
                    onChange={(e) => setNoteContent(e.target.value)}
                    placeholder="Write your note..."
                    rows={5}
                    className="app-input px-4 py-2.5 resize-none"
                  />
                </div>

                <button
                  type="submit"
                  disabled={isPending}
                  className="app-button-primary w-full py-3 px-4 flex items-center justify-center gap-2 mt-4"
                >
                  {isPending ? (
                    <span className="h-5 w-5 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                  ) : (
                    "Create Note"
                  )}
                </button>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
