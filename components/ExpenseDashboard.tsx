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
import { ACCOUNT_METHODS, getAccountLabel } from "@/lib/finance";
import {
  addDays,
  addMonths,
  differenceInCalendarDays,
  endOfDay,
  endOfMonth,
  endOfWeek,
  endOfYear,
  format,
  startOfDay,
  startOfMonth,
  startOfWeek,
  startOfYear,
  subMonths,
} from "date-fns";
import {
  Plus, Search, Trash2, Edit2, TrendingUp, TrendingDown, DollarSign,
  Banknote, HandCoins, ReceiptText, Pencil, Scale, ChevronLeft, ChevronRight
} from "lucide-react";
import toast from "react-hot-toast";

const PAGE_SIZE = 10;
const LOAN_PAGE_SIZE = 15;
type DatePeriod = "all" | "today" | "week" | "month" | "year" | "custom";

interface Transaction {
  id: string;
  type: string;
  amount: number;
  category: string;
  account: string;
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

interface ServerTransaction {
  id: string;
  type: string;
  amount: number;
  category: string;
  account: string | null;
  note: string | null;
  date: string | Date;
}

interface TransactionResult {
  transaction?: ServerTransaction;
  error?: string;
}

interface LoanPayment {
  id: string;
  transactionId: string | null;
  amount: number;
  account: string;
  note: string | null;
  date: string;
}

interface Loan {
  id: string;
  transactionId: string | null;
  direction: string;
  personName: string;
  principal: number;
  account: string;
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

function getPaid(loan: Loan) {
  return loan.payments.reduce((sum, payment) => sum + payment.amount, 0);
}

function getOutstanding(loan: Loan) {
  return Math.max(loan.principal - getPaid(loan), 0);
}

export default function ExpenseDashboard({
  transactions: initialTx,
  initialLoans,
}: ExpenseDashboardProps) {
  // Navigation / Tabs
  const [activeTab, setActiveTab] = useState<"expenses" | "loans">("expenses");

  // Expenses State
  const [transactions, setTransactions] = useState<Transaction[]>(initialTx);
  const [loans, setLoans] = useState<Loan[]>(initialLoans);
  const [showForm, setShowForm] = useState(false);
  const [txType, setTxType] = useState("EXPENSE");
  const [amount, setAmount] = useState("");
  const [expenseItems, setExpenseItems] = useState<CategoryItem[]>([]);
  const [incomeItems, setIncomeItems] = useState<CategoryItem[]>([]);
  const [expenseCategories, setExpenseCategories] = useState<string[]>([...DEFAULT_EXPENSE_CATEGORIES]);
  const [incomeCategories, setIncomeCategories] = useState<string[]>([...DEFAULT_INCOME_CATEGORIES]);
  const [category, setCategory] = useState<string>(DEFAULT_EXPENSE_CATEGORIES[0]);
  const [account, setAccount] = useState("CASH");
  const [note, setNote] = useState("");
  const [date, setDate] = useState(new Date().toISOString().split("T")[0]);
  const [search, setSearch] = useState("");
  const [filterType, setFilterType] = useState("all");
  const [filterCategory, setFilterCategory] = useState("all");
  const [filterAccount, setFilterAccount] = useState("all");
  const [datePeriod, setDatePeriod] = useState<DatePeriod>("all");
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

  const toClientTransaction = (transaction: ServerTransaction): Transaction => ({
    ...transaction,
    account: transaction.account || "CASH",
    date: transaction.date instanceof Date ? transaction.date.toISOString() : String(transaction.date),
  });

  const upsertTransaction = (transaction: ServerTransaction) => {
    const normalized = toClientTransaction(transaction);
    setTransactions((prev) =>
      prev.some((item) => item.id === normalized.id)
        ? prev.map((item) => (item.id === normalized.id ? normalized : item))
        : [normalized, ...prev]
    );
  };

  const takenLoanTransactionIds = useMemo(
    () =>
      new Set(
        loans
          .filter((loan) => loan.direction === "TAKEN" && loan.transactionId)
          .map((loan) => loan.transactionId as string)
      ),
    [loans]
  );
  const loanTakenLedgerIds = useMemo(
    () =>
      new Set(
        loans
          .filter((loan) => loan.direction === "TAKEN")
          .flatMap((loan) => [
            ...(loan.transactionId ? [loan.transactionId] : []),
            ...loan.payments.flatMap((payment) =>
              payment.transactionId ? [payment.transactionId] : []
            ),
          ])
      ),
    [loans]
  );
  const loanGivenLedgerIds = useMemo(
    () =>
      new Set(
        loans
          .filter((loan) => loan.direction === "GIVEN")
          .flatMap((loan) => [
            ...(loan.transactionId ? [loan.transactionId] : []),
            ...loan.payments.flatMap((payment) =>
              payment.transactionId ? [payment.transactionId] : []
            ),
          ])
      ),
    [loans]
  );
  const currentTotalIncome = useMemo(
    () =>
      transactions
        .filter(
          (transaction) =>
            transaction.type === "INCOME" && !takenLoanTransactionIds.has(transaction.id)
        )
        .reduce((sum, transaction) => sum + transaction.amount, 0),
    [transactions, takenLoanTransactionIds]
  );
  const currentTotalExpense = useMemo(
    () => transactions.filter((t) => t.type === "EXPENSE").reduce((sum, t) => sum + t.amount, 0),
    [transactions]
  );
  const balance = useMemo(
    () =>
      transactions.reduce(
        (sum, transaction) =>
          sum + (transaction.type === "INCOME" ? transaction.amount : -transaction.amount),
        0
      ),
    [transactions]
  );
  const selectedDateRange = useMemo(() => {
    const today = new Date();

    if (datePeriod === "today") {
      return { start: startOfDay(today), end: endOfDay(today) };
    }
    if (datePeriod === "week") {
      return {
        start: startOfWeek(today, { weekStartsOn: 1 }),
        end: endOfWeek(today, { weekStartsOn: 1 }),
      };
    }
    if (datePeriod === "month") {
      return { start: startOfMonth(today), end: endOfMonth(today) };
    }
    if (datePeriod === "year") {
      return { start: startOfYear(today), end: endOfYear(today) };
    }
    if (datePeriod === "custom") {
      return {
        start: dateFrom ? startOfDay(new Date(`${dateFrom}T00:00:00`)) : null,
        end: dateTo ? endOfDay(new Date(`${dateTo}T00:00:00`)) : null,
      };
    }
    return { start: null, end: null };
  }, [datePeriod, dateFrom, dateTo]);

  const periodTransactions = useMemo(
    () =>
      transactions.filter((transaction) => {
        const transactionDate = new Date(transaction.date);
        const matchesStart =
          !selectedDateRange.start || transactionDate >= selectedDateRange.start;
        const matchesEnd = !selectedDateRange.end || transactionDate <= selectedDateRange.end;
        return matchesStart && matchesEnd;
      }),
    [transactions, selectedDateRange]
  );

  const currentMonthlyData = useMemo(() => {
    const aggregate = (start: Date, end: Date, month: string) => {
      const bucket = periodTransactions.filter((transaction) => {
        const transactionDate = new Date(transaction.date);
        return transactionDate >= start && transactionDate <= end;
      });
      return {
        month,
        income: bucket
          .filter(
            (transaction) =>
              transaction.type === "INCOME" &&
              !takenLoanTransactionIds.has(transaction.id)
          )
          .reduce((sum, transaction) => sum + transaction.amount, 0),
        expense: bucket
          .filter((transaction) => transaction.type === "EXPENSE")
          .reduce((sum, transaction) => sum + transaction.amount, 0),
      };
    };

    const today = new Date();
    if (datePeriod === "today") {
      return [aggregate(startOfDay(today), endOfDay(today), "Today")];
    }
    if (datePeriod === "week") {
      const weekStart = startOfWeek(today, { weekStartsOn: 1 });
      return Array.from({ length: 7 }, (_, index) => {
        const day = addDays(weekStart, index);
        return aggregate(startOfDay(day), endOfDay(day), format(day, "EEE"));
      });
    }
    if (datePeriod === "month") {
      const monthStart = startOfMonth(today);
      const days = differenceInCalendarDays(endOfMonth(today), monthStart) + 1;
      return Array.from({ length: days }, (_, index) => {
        const day = addDays(monthStart, index);
        return aggregate(startOfDay(day), endOfDay(day), format(day, "d"));
      });
    }
    if (datePeriod === "year") {
      const yearStart = startOfYear(today);
      return Array.from({ length: 12 }, (_, index) => {
        const month = addMonths(yearStart, index);
        return aggregate(startOfMonth(month), endOfMonth(month), format(month, "MMM"));
      });
    }
    if (
      datePeriod === "custom" &&
      selectedDateRange.start &&
      selectedDateRange.end
    ) {
      if (selectedDateRange.end < selectedDateRange.start) return [];
      const days =
        differenceInCalendarDays(selectedDateRange.end, selectedDateRange.start) + 1;
      if (days <= 31) {
        return Array.from({ length: days }, (_, index) => {
          const day = addDays(selectedDateRange.start!, index);
          return aggregate(startOfDay(day), endOfDay(day), format(day, "MMM d"));
        });
      }

      const buckets: MonthlyData[] = [];
      let month = startOfMonth(selectedDateRange.start);
      while (month <= selectedDateRange.end) {
        buckets.push(
          aggregate(startOfMonth(month), endOfMonth(month), format(month, "MMM yy"))
        );
        month = addMonths(month, 1);
      }
      return buckets;
    }

    return Array.from({ length: 6 }, (_, index) => {
      const month = subMonths(today, 5 - index);
      return aggregate(startOfMonth(month), endOfMonth(month), format(month, "MMM yy"));
    });
  }, [datePeriod, periodTransactions, selectedDateRange, takenLoanTransactionIds]);

  const currentCategoryData = useMemo(() => {
    const categories = periodTransactions
      .filter((t) => t.type === "EXPENSE")
      .reduce<Record<string, number>>((acc, transaction) => {
        acc[transaction.category] = (acc[transaction.category] || 0) + transaction.amount;
        return acc;
      }, {});

    return Object.entries(categories)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);
  }, [periodTransactions]);

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
  const [statusFilter, setStatusFilter] = useState("all");
  const [loanTypeFilter, setLoanTypeFilter] = useState("all");
  const [loanAccountFilter, setLoanAccountFilter] = useState("all");
  const [loanPersonSearch, setLoanPersonSearch] = useState("");
  const [loanDatePeriod, setLoanDatePeriod] = useState<DatePeriod>("all");
  const [loanDateFrom, setLoanDateFrom] = useState("");
  const [loanDateTo, setLoanDateTo] = useState("");
  const [loanPage, setLoanPage] = useState(1);
  const [showLoanForm, setShowLoanForm] = useState(false);
  const [editingLoanId, setEditingLoanId] = useState<string | null>(null);
  const [loanDirection, setLoanDirection] = useState("GIVEN");
  const [personName, setPersonName] = useState("");
  const [principal, setPrincipal] = useState("");
  const [loanAccount, setLoanAccount] = useState("CASH");
  const [interestRate, setInterestRate] = useState("0");
  const [loanNote, setLoanNote] = useState("");
  const [loanDate, setLoanDate] = useState(new Date().toISOString().split("T")[0]);
  const [repayingLoanId, setRepayingLoanId] = useState<string | null>(null);
  const [repaymentAmount, setRepaymentAmount] = useState("");
  const [repaymentNote, setRepaymentNote] = useState("");
  const [repaymentDate, setRepaymentDate] = useState(
    new Date().toISOString().split("T")[0]
  );
  const [repaymentAccount, setRepaymentAccount] = useState("CASH");

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

  const loanDateRange = useMemo(() => {
    const today = new Date();
    if (loanDatePeriod === "today") {
      return { start: startOfDay(today), end: endOfDay(today) };
    }
    if (loanDatePeriod === "week") {
      return {
        start: startOfWeek(today, { weekStartsOn: 1 }),
        end: endOfWeek(today, { weekStartsOn: 1 }),
      };
    }
    if (loanDatePeriod === "month") {
      return { start: startOfMonth(today), end: endOfMonth(today) };
    }
    if (loanDatePeriod === "year") {
      return { start: startOfYear(today), end: endOfYear(today) };
    }
    if (loanDatePeriod === "custom") {
      return {
        start: loanDateFrom ? startOfDay(new Date(`${loanDateFrom}T00:00:00`)) : null,
        end: loanDateTo ? endOfDay(new Date(`${loanDateTo}T00:00:00`)) : null,
      };
    }
    return { start: null, end: null };
  }, [loanDatePeriod, loanDateFrom, loanDateTo]);
  const filteredLoans = useMemo(
    () =>
      [...loans]
        .filter((loan) => {
          const loanDay = new Date(loan.date);
          const matchesStatus = statusFilter === "all" || loan.status === statusFilter;
          const matchesType =
            loanTypeFilter === "all" || loan.direction === loanTypeFilter;
          const matchesAccount =
            loanAccountFilter === "all" || loan.account === loanAccountFilter;
          const matchesPerson =
            !loanPersonSearch ||
            loan.personName.toLowerCase().includes(loanPersonSearch.toLowerCase());
          const matchesStart = !loanDateRange.start || loanDay >= loanDateRange.start;
          const matchesEnd = !loanDateRange.end || loanDay <= loanDateRange.end;
          return (
            matchesStatus &&
            matchesType &&
            matchesAccount &&
            matchesPerson &&
            matchesStart &&
            matchesEnd
          );
        })
        .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()),
    [
      loans,
      statusFilter,
      loanTypeFilter,
      loanAccountFilter,
      loanPersonSearch,
      loanDateRange,
    ]
  );
  const loanTotalPages = Math.max(1, Math.ceil(filteredLoans.length / LOAN_PAGE_SIZE));
  const currentLoanPage = Math.min(loanPage, loanTotalPages);
  const paginatedLoans = useMemo(() => {
    const start = (currentLoanPage - 1) * LOAN_PAGE_SIZE;
    return filteredLoans.slice(start, start + LOAN_PAGE_SIZE);
  }, [filteredLoans, currentLoanPage]);
  const repayingLoan = loans.find((loan) => loan.id === repayingLoanId) || null;

  useEffect(() => {
    setLoanPage(1);
  }, [
    statusFilter,
    loanTypeFilter,
    loanAccountFilter,
    loanPersonSearch,
    loanDatePeriod,
    loanDateFrom,
    loanDateTo,
  ]);

  const linkedLoanTransactionIds = useMemo(
    () =>
      new Set(
        loans.flatMap((loan) => [
          ...(loan.transactionId ? [loan.transactionId] : []),
          ...loan.payments.flatMap((payment) =>
            payment.transactionId ? [payment.transactionId] : []
          ),
        ])
      ),
    [loans]
  );

  // Expense Handlers
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!amount || parseFloat(amount) <= 0) {
      toast.error("Enter a valid amount");
      return;
    }

    startTransition(async () => {
      if (editingId) {
        const res = await updateTransaction(editingId, {
          type: txType,
          amount,
          category,
          account,
          note,
          date,
        });
        if (res.success) {
          toast.success("Transaction updated!");
          setTransactions((prev) =>
            prev.map((t) =>
              t.id === editingId
                ? { ...t, type: txType, amount: parseFloat(amount), category, account, note, date }
                : t
            )
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
        formData.append("account", account);
        formData.append("note", note);
        formData.append("date", date);

        const res = await createTransaction(formData);
        if (res.success && res.transaction) {
          const transactionResult = res as TransactionResult;
          toast.success("Transaction recorded!");
          if (transactionResult.transaction) {
            const newTx = toClientTransaction(transactionResult.transaction);
            setTransactions((prev) => [newTx, ...prev]);
          }
          resetForm();
        } else {
          toast.error((res as TransactionResult).error || "Failed to record");
        }
      }
    });
  };

  const resetForm = () => {
    setAmount("");
    setAccount("CASH");
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
    setAccount(tx.account);
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
    setLoanAccount("CASH");
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
    setLoanAccount(loan.account);
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
          account: loanAccount,
          interestRate,
          note: loanNote,
          date: loanDate,
        });

        if (res.success && res.loan) {
          toast.success("Loan updated");
          if (res.transaction) {
            upsertTransaction(res.transaction);
          }
          res.paymentTransactions?.forEach((transaction) => {
            if (transaction) upsertTransaction(transaction);
          });
          setLoans((prev) =>
            prev.map((l) =>
              l.id === editingLoanId
                ? {
                    ...res.loan,
                    account: res.loan.account || "CASH",
                    date: res.loan.date instanceof Date ? res.loan.date.toISOString() : String(res.loan.date),
                    payments: res.loan.payments.map((p) => ({
                      ...p,
                      account: p.account || "CASH",
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
      formData.append("account", loanAccount);
      formData.append("interestRate", interestRate);
      formData.append("note", loanNote);
      formData.append("date", loanDate);

      const res = await createLoan(formData);
      if (res.success && res.loan) {
        toast.success("Loan recorded");
        if (res.transaction) {
          upsertTransaction(res.transaction);
        }
        setLoans((prev) => [
          {
            ...res.loan,
            account: res.loan.account || "CASH",
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
    const loanToDelete = loans.find((loan) => loan.id === id);

    startTransition(async () => {
      const res = await deleteLoan(id);
      if (res.success) {
        toast.success("Loan deleted");
        setLoans((prev) => prev.filter((l) => l.id !== id));
        if (repayingLoanId === id) setRepayingLoanId(null);
        const transactionIds = new Set([
          ...(loanToDelete?.transactionId ? [loanToDelete.transactionId] : []),
          ...(loanToDelete?.payments.flatMap((payment) =>
            payment.transactionId ? [payment.transactionId] : []
          ) || []),
        ]);
        if (transactionIds.size > 0) {
          setTransactions((prev) =>
            prev.filter((transaction) => !transactionIds.has(transaction.id))
          );
        }
      } else {
        toast.error(res.error || "Failed to delete loan");
      }
    });
  };

  const openRepaymentModal = (loan: Loan) => {
    setRepayingLoanId(loan.id);
    setRepaymentAmount("");
    setRepaymentNote("");
    setRepaymentDate(new Date().toISOString().split("T")[0]);
    setRepaymentAccount(loan.account || "CASH");
  };

  const closeRepaymentModal = () => {
    setRepayingLoanId(null);
    setRepaymentAmount("");
    setRepaymentNote("");
    setRepaymentDate(new Date().toISOString().split("T")[0]);
    setRepaymentAccount("CASH");
  };

  const handlePayment = (event: React.FormEvent) => {
    event.preventDefault();
    if (!repayingLoan) return;

    startTransition(async () => {
      const formData = new FormData();
      formData.append("loanId", repayingLoan.id);
      formData.append("amount", repaymentAmount);
      formData.append("account", repaymentAccount);
      formData.append("note", repaymentNote);
      formData.append("date", repaymentDate);

      const res = await createLoanPayment(formData);
      if (res.success && res.payment) {
        toast.success("Repayment recorded");
        if (res.transaction) {
          upsertTransaction(res.transaction);
        }
        const payment = {
          ...res.payment,
          account: res.payment.account || "CASH",
          date: res.payment.date instanceof Date ? res.payment.date.toISOString() : String(res.payment.date),
        };
        setLoans((prev) =>
          prev.map((item) => {
            if (item.id !== repayingLoan.id) return item;
            const payments = [payment, ...item.payments];
            const paid = payments.reduce((sum, entry) => sum + entry.amount, 0);
            return {
              ...item,
              payments,
              status: paid >= item.principal ? "PAID" : "OPEN",
            };
          })
        );
        setRepaymentAmount("");
        setRepaymentNote("");
      } else {
        toast.error(res.error || "Failed to record repayment");
      }
    });
  };

  const handleDeletePayment = (loanId: string, paymentId: string) => {
    const paymentToDelete = loans
      .find((loan) => loan.id === loanId)
      ?.payments.find((payment) => payment.id === paymentId);
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
        if (paymentToDelete?.transactionId) {
          setTransactions((prev) =>
            prev.filter((transaction) => transaction.id !== paymentToDelete.transactionId)
          );
        }
      } else {
        toast.error(res.error || "Failed to delete repayment");
      }
    });
  };

  const filtered = useMemo(() => {
    return periodTransactions.filter((t) => {
      const matchesType =
        filterType === "all" ||
        (filterType === "LOAN_TAKEN" && loanTakenLedgerIds.has(t.id)) ||
        (filterType === "LOAN_GIVEN" && loanGivenLedgerIds.has(t.id)) ||
        (t.type === filterType &&
          !loanTakenLedgerIds.has(t.id) &&
          !loanGivenLedgerIds.has(t.id));
      const matchesCategory =
        filterCategory === "all" || t.category === filterCategory;
      const matchesAccount = filterAccount === "all" || t.account === filterAccount;
      const matchesSearch =
        !search ||
        t.category.toLowerCase().includes(search.toLowerCase()) ||
        (t.note && t.note.toLowerCase().includes(search.toLowerCase()));

      return matchesType && matchesCategory && matchesAccount && matchesSearch;
    });
  }, [
    periodTransactions,
    filterType,
    filterCategory,
    filterAccount,
    search,
    loanTakenLedgerIds,
    loanGivenLedgerIds,
  ]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const paginated = useMemo(() => {
    const start = (currentPage - 1) * PAGE_SIZE;
    return filtered.slice(start, start + PAGE_SIZE);
  }, [filtered, currentPage]);

  useEffect(() => {
    setPage(1);
  }, [filterType, filterCategory, filterAccount, search, datePeriod, dateFrom, dateTo]);

  const formatBDT = (n: number) => `৳${Math.abs(n).toLocaleString("en-US")}`;
  const getTransactionTypeLabel = (transaction: Transaction) => {
    if (loanTakenLedgerIds.has(transaction.id)) return "Loan Taken";
    if (loanGivenLedgerIds.has(transaction.id)) return "Loan Given";
    return transaction.type === "INCOME" ? "Income" : "Expense";
  };

  return (
    <div className="space-y-8">
      {/* Visual Navigation Tabs */}
      <div className="flex bg-muted p-1 rounded-2xl border border-border max-w-md">
        <button
          onClick={() => setActiveTab("expenses")}
          className={`flex-1 flex items-center justify-center gap-2 py-3 px-4 rounded-xl text-xs font-bold transition-all active:scale-[0.98] ${
            activeTab === "expenses"
              ? "bg-primary text-primary-foreground shadow-lg shadow-primary/20"
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
              ? "bg-primary text-primary-foreground shadow-lg shadow-primary/20"
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
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-3">
            {[
              { label: "Balance", value: balance, color: balance >= 0 ? "text-income" : "text-expense", icon: DollarSign, bg: "bg-primary/10" },
              { label: "Total Income", value: currentTotalIncome, color: "text-income", icon: TrendingUp, bg: "bg-income/10" },
              { label: "Total Expense", value: currentTotalExpense, color: "text-expense", icon: TrendingDown, bg: "bg-expense/10" },
              { label: "Loan Payable", value: loanTotals.payable, color: "text-expense", icon: Banknote, bg: "bg-expense/10" },
              { label: "Loan Receivable", value: loanTotals.receivable, color: "text-income", icon: HandCoins, bg: "bg-income/10" },
              {
                label: "Savings %",
                value:
                  currentTotalIncome > 0
                    ? Math.max(
                        0,
                        Math.round(
                          ((currentTotalIncome - currentTotalExpense) / currentTotalIncome) * 100
                        )
                      )
                    : 0,
                color: "text-primary",
                icon: DollarSign,
                bg: "bg-primary/10",
                isPercent: true,
              },
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

          <div className="app-card flex flex-col gap-3 sm:flex-row sm:items-end">
            <div className="min-w-48">
              <label className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                Report Period
              </label>
              <select
                value={datePeriod}
                onChange={(event) => setDatePeriod(event.target.value as DatePeriod)}
                className="app-input py-2 text-xs"
              >
                <option value="all">All time</option>
                <option value="today">Today</option>
                <option value="week">This week</option>
                <option value="month">This month</option>
                <option value="year">This year</option>
                <option value="custom">Custom</option>
              </select>
            </div>
            {datePeriod === "custom" && (
              <>
                <div>
                  <label className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                    From
                  </label>
                  <DateInput
                    value={dateFrom}
                    onChange={(event) => setDateFrom(event.target.value)}
                    className="py-2 text-xs"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                    To
                  </label>
                  <DateInput
                    value={dateTo}
                    onChange={(event) => setDateTo(event.target.value)}
                    className="py-2 text-xs"
                  />
                </div>
              </>
            )}
          </div>

          {/* Charts Row */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="app-card">
              <h3 className="font-bold text-card-foreground text-sm mb-4">Income vs Expenses</h3>
              <IncomeExpenseBarChart data={currentMonthlyData} />
            </div>
            <div className="app-card">
              <h3 className="font-bold text-card-foreground text-sm mb-4">Expense Breakdown by Category</h3>
              <ExpensePieChart data={currentCategoryData} />
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

            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3 mb-6">
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
                <option value="LOAN_TAKEN">Loan Taken</option>
                <option value="LOAN_GIVEN">Loan Given</option>
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
              <select
                value={filterAccount}
                onChange={(e) => setFilterAccount(e.target.value)}
                className="app-input py-2 text-xs"
              >
                <option value="all">All accounts</option>
                {ACCOUNT_METHODS.map((method) => (
                  <option key={method.value} value={method.value}>{method.label}</option>
                ))}
              </select>
            </div>

            {(filterType !== "all" || filterCategory !== "all" || filterAccount !== "all" || search || datePeriod !== "all") && (
              <div className="mb-4">
                <button
                  type="button"
                  onClick={() => {
                    setFilterType("all");
                    setFilterCategory("all");
                    setFilterAccount("all");
                    setSearch("");
                    setDatePeriod("all");
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
                      <tr className="border-b border-border">
                        {["Type", "Category", "Account", "Note", "Date", "Amount", ""].map((h) => (
                          <th key={h} className="pb-3 text-[10px] uppercase font-bold text-muted-foreground tracking-wider pr-4 last:pr-0">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border/50">
                      {paginated.map((tx) => {
                        const isLoanTransaction =
                          loanTakenLedgerIds.has(tx.id) || loanGivenLedgerIds.has(tx.id);
                        return (
                        <tr key={tx.id} className="hover:bg-muted/50 transition-colors group">
                          <td className="py-3 pr-4">
                            <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full ${
                              isLoanTransaction
                                ? "bg-primary/10 text-primary border border-primary/20"
                                : tx.type === "INCOME"
                                ? "bg-income/10 text-income border border-income/20"
                                : "bg-expense/10 text-expense border border-expense/20"
                            }`}>
                              {getTransactionTypeLabel(tx)}
                            </span>
                          </td>
                          <td className="py-3 pr-4 text-xs font-medium text-foreground max-w-[160px] truncate">{tx.category}</td>
                          <td className="py-3 pr-4 text-xs font-semibold text-foreground whitespace-nowrap">
                            {getAccountLabel(tx.account)}
                          </td>
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
                            {linkedLoanTransactionIds.has(tx.id) ? (
                              <span className="text-[10px] font-semibold text-muted-foreground">Managed in Loans</span>
                            ) : (
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
                            )}
                          </td>
                        </tr>
                        );
                      })}
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

          <div className="app-card">
            <div className="mb-5 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="text-lg font-bold text-card-foreground">Loan Ledger</h2>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {filteredLoans.length} loan{filteredLoans.length === 1 ? "" : "s"}
                  {filteredLoans.length > 0 && (
                    <> · Page {currentLoanPage} of {loanTotalPages}</>
                  )}
                </p>
              </div>
              <button
                onClick={() => {
                  resetLoanForm();
                  setShowLoanForm(true);
                }}
                className="app-button-primary flex items-center gap-2 self-start text-xs"
              >
                <Plus className="h-4 w-4" /> Add Loan
              </button>
            </div>

            <div className="mb-5 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-5">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <input
                  value={loanPersonSearch}
                  onChange={(event) => setLoanPersonSearch(event.target.value)}
                  placeholder="Search person..."
                  className="app-input py-2 pl-9 text-xs"
                />
              </div>
              <select
                value={loanTypeFilter}
                onChange={(event) => setLoanTypeFilter(event.target.value)}
                className="app-input py-2 text-xs"
              >
                <option value="all">All loan types</option>
                <option value="GIVEN">Given</option>
                <option value="TAKEN">Taken</option>
              </select>
              <select
                value={statusFilter}
                onChange={(event) => setStatusFilter(event.target.value)}
                className="app-input py-2 text-xs"
              >
                <option value="all">All statuses</option>
                <option value="OPEN">Open</option>
                <option value="PAID">Paid</option>
              </select>
              <select
                value={loanAccountFilter}
                onChange={(event) => setLoanAccountFilter(event.target.value)}
                className="app-input py-2 text-xs"
              >
                <option value="all">All accounts</option>
                {ACCOUNT_METHODS.map((method) => (
                  <option key={method.value} value={method.value}>{method.label}</option>
                ))}
              </select>
              <select
                value={loanDatePeriod}
                onChange={(event) => setLoanDatePeriod(event.target.value as DatePeriod)}
                className="app-input py-2 text-xs"
              >
                <option value="all">All dates</option>
                <option value="today">Today</option>
                <option value="week">This week</option>
                <option value="month">This month</option>
                <option value="year">This year</option>
                <option value="custom">Custom</option>
              </select>
            </div>

            {loanDatePeriod === "custom" && (
              <div className="mb-5 grid grid-cols-1 gap-3 sm:max-w-lg sm:grid-cols-2">
                <DateInput
                  value={loanDateFrom}
                  onChange={(event) => setLoanDateFrom(event.target.value)}
                  className="py-2 text-xs"
                  title="Loan date from"
                />
                <DateInput
                  value={loanDateTo}
                  onChange={(event) => setLoanDateTo(event.target.value)}
                  className="py-2 text-xs"
                  title="Loan date to"
                />
              </div>
            )}

            {(loanTypeFilter !== "all" ||
              statusFilter !== "all" ||
              loanAccountFilter !== "all" ||
              loanPersonSearch ||
              loanDatePeriod !== "all") && (
              <button
                type="button"
                onClick={() => {
                  setLoanTypeFilter("all");
                  setStatusFilter("all");
                  setLoanAccountFilter("all");
                  setLoanPersonSearch("");
                  setLoanDatePeriod("all");
                  setLoanDateFrom("");
                  setLoanDateTo("");
                }}
                className="mb-5 text-[11px] font-bold text-primary hover:underline"
              >
                Clear filters
              </button>
            )}

            {filteredLoans.length === 0 ? (
              <div className="py-14 text-center text-muted-foreground">
                <HandCoins className="mx-auto mb-3 h-12 w-12 opacity-20" />
                <p className="text-sm font-semibold">No loans found</p>
              </div>
            ) : (
              <>
                <div className="overflow-x-auto">
                  <table className="w-full text-left">
                    <thead>
                      <tr className="border-b border-border">
                        {[
                          "Date",
                          "Type / Person",
                          "Account",
                          "Principal",
                          "Paid",
                          "Outstanding",
                          "Status",
                          "Actions",
                        ].map((heading) => (
                          <th
                            key={heading}
                            className="pb-3 pr-4 text-[10px] font-bold uppercase tracking-wider text-muted-foreground last:pr-0"
                          >
                            {heading}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border/50">
                      {paginatedLoans.map((loan) => {
                        const paid = getPaid(loan);
                        const outstanding = getOutstanding(loan);
                        return (
                          <tr key={loan.id} className="group transition-colors hover:bg-muted/50">
                            <td className="whitespace-nowrap py-3 pr-4 text-xs text-muted-foreground">
                              {new Date(loan.date).toLocaleDateString("en-US", {
                                month: "short",
                                day: "numeric",
                                year: "2-digit",
                              })}
                            </td>
                            <td className="py-3 pr-4">
                              <div className="flex items-center gap-2">
                                <span
                                  className={`rounded-full border px-2 py-0.5 text-[10px] font-bold ${
                                    loan.direction === "GIVEN"
                                      ? "border-income/20 bg-income/10 text-income"
                                      : "border-expense/20 bg-expense/10 text-expense"
                                  }`}
                                >
                                  {loan.direction === "GIVEN" ? "Given" : "Taken"}
                                </span>
                                <div>
                                  <p className="whitespace-nowrap text-xs font-semibold text-foreground">
                                    {loan.personName}
                                  </p>
                                  {loan.note && (
                                    <p className="max-w-40 truncate text-[10px] text-muted-foreground">
                                      {loan.note}
                                    </p>
                                  )}
                                </div>
                              </div>
                            </td>
                            <td className="whitespace-nowrap py-3 pr-4 text-xs font-semibold">
                              {getAccountLabel(loan.account)}
                            </td>
                            <td className="whitespace-nowrap py-3 pr-4 text-xs font-bold">
                              {formatBDT(loan.principal)}
                            </td>
                            <td className="whitespace-nowrap py-3 pr-4 text-xs font-bold text-primary">
                              {formatBDT(paid)}
                            </td>
                            <td className={`whitespace-nowrap py-3 pr-4 text-xs font-bold ${
                              loan.direction === "GIVEN" ? "text-income" : "text-expense"
                            }`}>
                              {formatBDT(outstanding)}
                            </td>
                            <td className="py-3 pr-4">
                              <span className="rounded-full border border-border bg-muted px-2 py-0.5 text-[10px] font-bold text-muted-foreground">
                                {loan.status}
                              </span>
                            </td>
                            <td className="py-3 text-right">
                              <div className="flex items-center justify-end gap-1">
                                <button
                                  type="button"
                                  disabled={outstanding === 0}
                                  onClick={() => openRepaymentModal(loan)}
                                  className="inline-flex items-center gap-1 rounded-lg px-2 py-1.5 text-[10px] font-bold text-primary hover:bg-primary/10 disabled:cursor-not-allowed disabled:opacity-40"
                                >
                                  <ReceiptText className="h-3.5 w-3.5" /> Repay
                                </button>
                                <button
                                  onClick={() => startEditLoan(loan)}
                                  className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted hover:text-primary"
                                  title="Edit loan"
                                >
                                  <Pencil className="h-3.5 w-3.5" />
                                </button>
                                <button
                                  onClick={() => handleDeleteLoan(loan.id)}
                                  className="rounded-lg p-1.5 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                                  title="Delete loan"
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                {loanTotalPages > 1 && (
                  <div className="mt-6 flex items-center justify-between gap-3 border-t border-border/40 pt-4">
                    <p className="text-[11px] text-muted-foreground">
                      Showing {(currentLoanPage - 1) * LOAN_PAGE_SIZE + 1}–
                      {Math.min(currentLoanPage * LOAN_PAGE_SIZE, filteredLoans.length)} of{" "}
                      {filteredLoans.length}
                    </p>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        disabled={currentLoanPage <= 1}
                        onClick={() => setLoanPage((value) => Math.max(1, value - 1))}
                        className="inline-flex items-center gap-1 rounded-xl border border-border px-3 py-1.5 text-xs font-semibold hover:bg-muted disabled:cursor-not-allowed disabled:opacity-40"
                      >
                        <ChevronLeft className="h-3.5 w-3.5" /> Prev
                      </button>
                      <span className="min-w-12 text-center text-xs font-bold tabular-nums">
                        {currentLoanPage}/{loanTotalPages}
                      </span>
                      <button
                        type="button"
                        disabled={currentLoanPage >= loanTotalPages}
                        onClick={() =>
                          setLoanPage((value) => Math.min(loanTotalPages, value + 1))
                        }
                        className="inline-flex items-center gap-1 rounded-xl border border-border px-3 py-1.5 text-xs font-semibold hover:bg-muted disabled:cursor-not-allowed disabled:opacity-40"
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

      <FormModal
        open={Boolean(repayingLoan)}
        onClose={closeRepaymentModal}
        title={repayingLoan ? `Repay ${repayingLoan.personName}` : "Record Repayment"}
      >
        {repayingLoan && (
          <div className="space-y-5">
            <div className="grid grid-cols-3 gap-3 rounded-2xl border border-border bg-muted/30 p-4 text-xs">
              <div>
                <p className="text-muted-foreground">Principal</p>
                <p className="mt-1 font-bold text-foreground">
                  {formatBDT(repayingLoan.principal)}
                </p>
              </div>
              <div>
                <p className="text-muted-foreground">Paid</p>
                <p className="mt-1 font-bold text-primary">{formatBDT(getPaid(repayingLoan))}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Outstanding</p>
                <p className={`mt-1 font-bold ${
                  repayingLoan.direction === "GIVEN" ? "text-income" : "text-expense"
                }`}>
                  {formatBDT(getOutstanding(repayingLoan))}
                </p>
              </div>
            </div>

            <form onSubmit={handlePayment} className="space-y-4">
              <div>
                <label className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                  Repayment Amount
                </label>
                <input
                  required
                  type="number"
                  min="0.01"
                  max={getOutstanding(repayingLoan)}
                  step="0.01"
                  value={repaymentAmount}
                  onChange={(event) => setRepaymentAmount(event.target.value)}
                  className="app-input text-xs"
                  placeholder="Enter amount"
                />
              </div>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                    Account
                  </label>
                  <select
                    value={repaymentAccount}
                    onChange={(event) => setRepaymentAccount(event.target.value)}
                    className="app-input text-xs"
                  >
                    {ACCOUNT_METHODS.map((method) => (
                      <option key={method.value} value={method.value}>{method.label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                    Date
                  </label>
                  <DateInput
                    required
                    value={repaymentDate}
                    onChange={(event) => setRepaymentDate(event.target.value)}
                    className="text-xs"
                  />
                </div>
              </div>
              <div>
                <label className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                  Statement / Note
                </label>
                <input
                  value={repaymentNote}
                  onChange={(event) => setRepaymentNote(event.target.value)}
                  className="app-input text-xs"
                  placeholder="Optional repayment statement"
                />
              </div>
              <button
                type="submit"
                disabled={isPending || getOutstanding(repayingLoan) === 0}
                className="app-button-primary flex w-full items-center justify-center gap-2 py-2.5 text-xs"
              >
                <ReceiptText className="h-4 w-4" />
                {isPending ? "Saving..." : "Record Repayment"}
              </button>
            </form>

            <div>
              <h3 className="mb-2 text-xs font-bold text-card-foreground">Repayment History</h3>
              {repayingLoan.payments.length === 0 ? (
                <p className="rounded-xl border border-dashed border-border py-6 text-center text-xs text-muted-foreground">
                  No repayments recorded
                </p>
              ) : (
                <div className="max-h-56 divide-y divide-border overflow-y-auto rounded-xl border border-border">
                  {repayingLoan.payments.map((payment) => (
                    <div
                      key={payment.id}
                      className="flex items-center justify-between gap-3 px-3 py-2.5 text-xs"
                    >
                      <div>
                        <p className="font-bold text-foreground">{formatBDT(payment.amount)}</p>
                        <p className="text-muted-foreground">
                          {new Date(payment.date).toLocaleDateString()} ·{" "}
                          {getAccountLabel(payment.account)}
                          {payment.note ? ` · ${payment.note}` : ""}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleDeletePayment(repayingLoan.id, payment.id)}
                        className="rounded-lg p-1.5 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                        title="Delete repayment"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </FormModal>

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

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <CategorySelect
              type={txType as CategoryType}
              value={category}
              options={activeCategories}
              onChange={setCategory}
              onCategoryAdded={handleCategoryAdded}
              onCategoryDeleted={handleCategoryDeleted}
            />
            <div>
              <label className="text-[10px] uppercase font-bold text-muted-foreground block mb-1">Account</label>
              <select
                value={account}
                onChange={(event) => setAccount(event.target.value)}
                className="app-input text-xs"
              >
                {ACCOUNT_METHODS.map((method) => (
                  <option key={method.value} value={method.value}>{method.label}</option>
                ))}
              </select>
            </div>
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
              Account
            </label>
            <select
              className="app-input text-xs"
              value={loanAccount}
              onChange={(event) => setLoanAccount(event.target.value)}
            >
              {ACCOUNT_METHODS.map((method) => (
                <option key={method.value} value={method.value}>{method.label}</option>
              ))}
            </select>
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
