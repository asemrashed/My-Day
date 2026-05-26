"use client";

import { useState, useTransition } from "react";
import { createTask } from "@/app/actions/tasks";
import { createTransaction } from "@/app/actions/transactions";
import { Plus, X, CheckSquare, DollarSign } from "lucide-react";
import toast from "react-hot-toast";

const expenseCategories = [
  "🚌 Transport (Rickshaw, Bus, CNG, Uber, Pathao)",
  "🍛 Food (Meal, Tea, Snacks, Restaurant)",
  "🌐 Internet (Broadband, Mobile Data)",
  "🤖 AI Tools (Claude, ChatGPT, Copilot)",
  "☁️ Dev Tools (Domain, Hosting, Software)",
  "📱 Mobile Recharge",
  "🏠 Rent & Utilities",
  "👨👩👧 Family Support",
  "🏥 Healthcare",
  "📚 Learning (Courses, Books)",
  "💸 Miscellaneous",
];

const incomeCategories = ["Salary", "Freelance", "Side Project", "Other"];

const taskCategories = ["Work", "Personal", "Learning", "Health", "Shopping", "Other"];

export default function QuickAddModal() {
  const [isOpen, setIsOpen] = useState(false);
  const [activeModal, setActiveModal] = useState<"none" | "task" | "transaction">("none");
  const [isPending, startTransition] = useTransition();

  // Task form states
  const [taskTitle, setTaskTitle] = useState("");
  const [taskDesc, setTaskDesc] = useState("");
  const [taskDueDate, setTaskDueDate] = useState("");
  const [taskPriority, setTaskPriority] = useState("MEDIUM");
  const [taskCategory, setTaskCategory] = useState("Work");

  // Transaction form states
  const [txType, setTxType] = useState("EXPENSE");
  const [txAmount, setTxAmount] = useState("");
  const [txCategory, setTxCategory] = useState(expenseCategories[0]);
  const [txNote, setTxNote] = useState("");
  const [txDate, setTxDate] = useState(new Date().toISOString().split("T")[0]);

  const handleTaskSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!taskTitle) {
      toast.error("Task title is required");
      return;
    }

    startTransition(async () => {
      const formData = new FormData();
      formData.append("title", taskTitle);
      formData.append("description", taskDesc);
      formData.append("dueDate", taskDueDate);
      formData.append("priority", taskPriority);
      formData.append("category", taskCategory);

      const res = await createTask(formData);
      if (res.success) {
        toast.success("Task added successfully!");
        // Reset and close
        setTaskTitle("");
        setTaskDesc("");
        setTaskDueDate("");
        setTaskPriority("MEDIUM");
        setTaskCategory("Work");
        setActiveModal("none");
        setIsOpen(false);
      } else {
        toast.error(res.error || "Failed to add task");
      }
    });
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
      formData.append("note", txNote);
      formData.append("date", txDate);

      const res = await createTransaction(formData);
      if (res.success) {
        toast.success(`${txType === "INCOME" ? "Income" : "Expense"} added successfully!`);
        // Reset and close
        setTxAmount("");
        setTxNote("");
        setTxDate(new Date().toISOString().split("T")[0]);
        setActiveModal("none");
        setIsOpen(false);
      } else {
        toast.error(res.error || "Failed to add transaction");
      }
    });
  };

  return (
    <div className="fixed bottom-24 md:bottom-8 right-6 z-50">
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
              setTxCategory(txType === "INCOME" ? incomeCategories[0] : expenseCategories[0]);
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
              <form onSubmit={handleTaskSubmit} className="space-y-4">
                <h3 className="text-xl font-bold text-card-foreground mb-2">Create New Task</h3>

                <div>
                  <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block mb-1">
                    Task Title
                  </label>
                  <input
                    type="text"
                    required
                    value={taskTitle}
                    onChange={(e) => setTaskTitle(e.target.value)}
                    placeholder="e.g. Code auth flow"
                    className="app-input px-4 py-2.5"
                  />
                </div>

                <div>
                  <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block mb-1">
                    Description (Optional)
                  </label>
                  <textarea
                    value={taskDesc}
                    onChange={(e) => setTaskDesc(e.target.value)}
                    placeholder="Provide details about the task..."
                    rows={3}
                    className="app-input px-4 py-2.5 resize-none"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block mb-1">
                      Due Date & Time
                    </label>
                    <input
                      type="datetime-local"
                      value={taskDueDate}
                      onChange={(e) => setTaskDueDate(e.target.value)}
                      className="app-input px-4 py-2.5 text-sm"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block mb-1">
                      Priority
                    </label>
                    <select
                      value={taskPriority}
                      onChange={(e) => setTaskPriority(e.target.value)}
                      className="app-input px-4 py-2.5 text-sm"
                    >
                      <option value="HIGH">🔴 High</option>
                      <option value="MEDIUM">🟡 Medium</option>
                      <option value="LOW">🔵 Low</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block mb-1">
                    Category
                  </label>
                  <select
                    value={taskCategory}
                    onChange={(e) => setTaskCategory(e.target.value)}
                    className="app-input px-4 py-2.5 text-sm"
                  >
                    {taskCategories.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                </div>

                <button
                  type="submit"
                  disabled={isPending}
                  className="app-button-primary w-full py-3 px-4 flex items-center justify-center gap-2 mt-4"
                >
                  {isPending ? (
                    <span className="h-5 w-5 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                  ) : (
                    "Create Task"
                  )}
                </button>
              </form>
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

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block mb-1">
                      Category
                    </label>
                    <select
                      value={txCategory}
                      onChange={(e) => setTxCategory(e.target.value)}
                      className="app-input px-4 py-2.5 text-sm"
                    >
                      {txType === "EXPENSE"
                        ? expenseCategories.map((c) => (
                            <option key={c} value={c}>
                              {c}
                            </option>
                          ))
                        : incomeCategories.map((c) => (
                            <option key={c} value={c}>
                              {c}
                            </option>
                          ))}
                    </select>
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block mb-1">
                      Transaction Date
                    </label>
                    <input
                      type="date"
                      required
                      value={txDate}
                      onChange={(e) => setTxDate(e.target.value)}
                      className="app-input px-4 py-2.5 text-sm"
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
          </div>
        </div>
      )}
    </div>
  );
}
