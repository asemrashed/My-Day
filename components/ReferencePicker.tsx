"use client";

import { useEffect, useMemo, useState } from "react";
import FormModal from "@/components/FormModal";
import DateInput from "@/components/DateInput";
import { CreditCard, Target, CheckSquare, Search } from "lucide-react";
import toast from "react-hot-toast";
import { useGoalOptionRows, useTasksBoard, useTransactionsList } from "@/hooks/useAppQueries";

export type ReferenceTarget = { targetType: string; targetId: string };

type PickerTab = "TRANSACTION" | "GOAL" | "TASK";

type TxItem = {
  id: string;
  type: string;
  amount: number;
  category: string;
  note: string | null;
  date: string;
};

type GoalItem = {
  id: string;
  title: string;
  period: string;
  progress: number;
  isCompleted: boolean;
  dueDate: string | null;
};

type TaskItem = {
  id: string;
  title: string;
  status: string;
  priority: string;
  category: string;
  dueDate: string | null;
};

interface ReferencePickerProps {
  open: boolean;
  onClose: () => void;
  onAttach: (targets: ReferenceTarget[]) => Promise<void>;
  /** Target types that can't be picked, e.g. exclude NOTE self-references */
  excludeIds?: string[];
}

const TABS: { key: PickerTab; label: string; icon: typeof CreditCard }[] = [
  { key: "TRANSACTION", label: "Expenses", icon: CreditCard },
  { key: "GOAL", label: "Goals", icon: Target },
  { key: "TASK", label: "Tasks", icon: CheckSquare },
];

export default function ReferencePicker({ open, onClose, onAttach, excludeIds = [] }: ReferencePickerProps) {
  const [tab, setTab] = useState<PickerTab>("TRANSACTION");
  const [selected, setSelected] = useState<Map<string, ReferenceTarget>>(new Map());
  const [isAttaching, setIsAttaching] = useState(false);

  const [search, setSearch] = useState("");
  const [txType, setTxType] = useState("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  const { data: txData, isFetching: txLoading } = useTransactionsList(open);
  const { data: goalRows = [], isFetching: goalsLoading } = useGoalOptionRows(open);
  const { data: board, isFetching: tasksLoading } = useTasksBoard(undefined, open);
  const loading = open && (txLoading || goalsLoading || tasksLoading) && !txData && goalRows.length === 0 && !board;

  const transactions = (Array.isArray(txData) ? txData : []) as TxItem[];
  const goals = goalRows as GoalItem[];
  const tasks = (board?.tasks || []) as TaskItem[];

  useEffect(() => {
    if (!open) return;
    setSelected(new Map());
    setSearch("");
    setTxType("all");
    setDateFrom("");
    setDateTo("");
  }, [open]);

  const q = search.trim().toLowerCase();

  const filteredTx = useMemo(
    () =>
      transactions.filter((t) => {
        if (excludeIds.includes(t.id)) return false;
        if (txType !== "all" && t.type !== txType) return false;
        const day = t.date.slice(0, 10);
        if (dateFrom && day < dateFrom) return false;
        if (dateTo && day > dateTo) return false;
        if (q && !`${t.category} ${t.note || ""} ${t.amount}`.toLowerCase().includes(q)) return false;
        return true;
      }),
    [transactions, excludeIds, txType, dateFrom, dateTo, q]
  );

  const filteredGoals = useMemo(
    () =>
      goals.filter((g) => {
        if (excludeIds.includes(g.id)) return false;
        const day = g.dueDate ? g.dueDate.slice(0, 10) : "";
        if (dateFrom && (!day || day < dateFrom)) return false;
        if (dateTo && (!day || day > dateTo)) return false;
        if (q && !`${g.title} ${g.period}`.toLowerCase().includes(q)) return false;
        return true;
      }),
    [goals, excludeIds, dateFrom, dateTo, q]
  );

  const filteredTasks = useMemo(
    () =>
      tasks.filter((t) => {
        if (excludeIds.includes(t.id)) return false;
        const day = t.dueDate ? t.dueDate.slice(0, 10) : "";
        if (dateFrom && (!day || day < dateFrom)) return false;
        if (dateTo && (!day || day > dateTo)) return false;
        if (q && !`${t.title} ${t.category} ${t.priority} ${t.status}`.toLowerCase().includes(q)) return false;
        return true;
      }),
    [tasks, excludeIds, dateFrom, dateTo, q]
  );

  const toggle = (targetType: PickerTab, targetId: string) => {
    setSelected((prev) => {
      const next = new Map(prev);
      const key = `${targetType}:${targetId}`;
      if (next.has(key)) next.delete(key);
      else next.set(key, { targetType, targetId });
      return next;
    });
  };

  const isSelected = (targetType: PickerTab, targetId: string) => selected.has(`${targetType}:${targetId}`);

  const handleAttach = async () => {
    if (selected.size === 0) {
      toast.error("Select at least one item");
      return;
    }
    setIsAttaching(true);
    try {
      await onAttach(Array.from(selected.values()));
      onClose();
    } finally {
      setIsAttaching(false);
    }
  };

  const selectedTxTotal = useMemo(() => {
    let total = 0;
    for (const t of transactions) {
      if (selected.has(`TRANSACTION:${t.id}`)) total += t.type === "EXPENSE" ? t.amount : -t.amount;
    }
    return total;
  }, [selected, transactions]);

  const rowClass = (active: boolean) =>
    `w-full text-left p-3 rounded-xl border text-xs transition-all cursor-pointer ${
      active
        ? "border-primary bg-primary/10 ring-1 ring-primary/30"
        : "border-border bg-muted/40 hover:border-primary/40"
    }`;

  return (
    <FormModal open={open} onClose={onClose} title="Attach Reference" maxWidth="xl">
      <div className="space-y-4">
        {/* Tabs */}
        <div className="flex bg-muted p-1 rounded-xl border border-border text-xs font-semibold">
          {TABS.map(({ key, label, icon: Icon }) => (
            <button
              key={key}
              type="button"
              onClick={() => setTab(key)}
              className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg transition-all ${
                tab === key ? "bg-primary text-primary-foreground shadow" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <Icon className="h-3.5 w-3.5" />
              {label}
            </button>
          ))}
        </div>

        {/* Filters */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          <div className="relative col-span-2">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search..."
              className="app-input pl-8 py-2 text-xs w-full"
            />
          </div>
          {tab === "TRANSACTION" ? (
            <select value={txType} onChange={(e) => setTxType(e.target.value)} className="app-input py-2 text-xs">
              <option value="all">All types</option>
              <option value="EXPENSE">Expense</option>
              <option value="INCOME">Income</option>
            </select>
          ) : (
            <DateInput value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="py-2 text-xs" title="From date" />
          )}
          {tab === "TRANSACTION" ? (
            <div className="grid grid-cols-2 gap-2 col-span-2 sm:col-span-1">
              <DateInput value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="py-2 text-xs" title="From" />
              <DateInput value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="py-2 text-xs" title="To" />
            </div>
          ) : (
            <DateInput value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="py-2 text-xs" title="To date" />
          )}
        </div>

        {/* Results */}
        <div className="max-h-[45vh] overflow-y-auto slim-scrollbar space-y-2 pr-1">
          {loading ? (
            <p className="text-xs text-muted-foreground text-center py-8">Loading...</p>
          ) : tab === "TRANSACTION" ? (
            filteredTx.length === 0 ? (
              <p className="text-xs text-muted-foreground text-center py-8">No transactions match</p>
            ) : (
              filteredTx.map((t) => (
                <div key={t.id} onClick={() => toggle("TRANSACTION", t.id)} className={rowClass(isSelected("TRANSACTION", t.id))}>
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-bold truncate">{t.category}</span>
                    <span className={`font-bold tabular-nums shrink-0 ${t.type === "EXPENSE" ? "text-rose-500" : "text-emerald-500"}`}>
                      {t.type === "EXPENSE" ? "-" : "+"}৳{t.amount.toLocaleString()}
                    </span>
                  </div>
                  <div className="flex items-center justify-between gap-2 mt-1 text-muted-foreground">
                    <span className="truncate">{t.note || "No note"}</span>
                    <span className="shrink-0">{new Date(t.date).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}</span>
                  </div>
                </div>
              ))
            )
          ) : tab === "GOAL" ? (
            filteredGoals.length === 0 ? (
              <p className="text-xs text-muted-foreground text-center py-8">No goals match</p>
            ) : (
              filteredGoals.map((g) => (
                <div key={g.id} onClick={() => toggle("GOAL", g.id)} className={rowClass(isSelected("GOAL", g.id))}>
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-bold truncate">{g.title}</span>
                    <span className="shrink-0 text-muted-foreground">{g.progress}%</span>
                  </div>
                  <div className="flex items-center justify-between gap-2 mt-1 text-muted-foreground">
                    <span className="capitalize">{g.period.toLowerCase()}</span>
                    {g.dueDate && <span>{new Date(g.dueDate).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}</span>}
                  </div>
                </div>
              ))
            )
          ) : filteredTasks.length === 0 ? (
            <p className="text-xs text-muted-foreground text-center py-8">No tasks match</p>
          ) : (
            filteredTasks.map((t) => (
              <div key={t.id} onClick={() => toggle("TASK", t.id)} className={rowClass(isSelected("TASK", t.id))}>
                <div className="flex items-center justify-between gap-2">
                  <span className={`font-bold truncate ${t.status === "DONE" ? "line-through text-muted-foreground" : ""}`}>{t.title}</span>
                  <span className="shrink-0 text-[10px] font-bold uppercase text-muted-foreground">{t.status.replace("_", " ")}</span>
                </div>
                <div className="flex items-center justify-between gap-2 mt-1 text-muted-foreground">
                  <span>{t.category} · {t.priority}</span>
                  {t.dueDate && <span>{new Date(t.dueDate).toLocaleDateString("en-US", { month: "short", day: "numeric" })}</span>}
                </div>
              </div>
            ))
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between gap-3 pt-2 border-t border-border">
          <p className="text-xs text-muted-foreground">
            {selected.size} selected
            {selectedTxTotal !== 0 && (
              <span className="ml-2 font-bold text-foreground">Net: ৳{Math.abs(selectedTxTotal).toLocaleString()} {selectedTxTotal > 0 ? "spent" : "earned"}</span>
            )}
          </p>
          <button
            type="button"
            onClick={handleAttach}
            disabled={isAttaching || selected.size === 0}
            className="app-button-primary py-2 px-4 text-xs disabled:opacity-50"
          >
            {isAttaching ? "Attaching..." : `Attach ${selected.size > 0 ? `(${selected.size})` : ""}`}
          </button>
        </div>
      </div>
    </FormModal>
  );
}
