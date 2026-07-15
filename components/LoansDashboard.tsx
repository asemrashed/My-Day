"use client";

import { useMemo, useState, useTransition } from "react";
import {
  createLoan,
  createLoanPayment,
  deleteLoan,
  deleteLoanPayment,
  updateLoan,
} from "@/app/actions/loans";
import DateInput from "@/components/DateInput";
import { Banknote, HandCoins, Pencil, Plus, ReceiptText, Trash2, X } from "lucide-react";
import toast from "react-hot-toast";

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

interface LoansDashboardProps {
  initialLoans: Loan[];
}

function formatBDT(amount: number) {
  return `৳ ${amount.toLocaleString("en-US", { maximumFractionDigits: 2 })}`;
}

function getPaid(loan: Loan) {
  return loan.payments.reduce((sum, payment) => sum + payment.amount, 0);
}

function getOutstanding(loan: Loan) {
  return Math.max(loan.principal - getPaid(loan), 0);
}

export default function LoansDashboard({ initialLoans }: LoansDashboardProps) {
  const [loans, setLoans] = useState(initialLoans);
  const [statusFilter, setStatusFilter] = useState("OPEN");
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [direction, setDirection] = useState("GIVEN");
  const [personName, setPersonName] = useState("");
  const [principal, setPrincipal] = useState("");
  const [interestRate, setInterestRate] = useState("0");
  const [note, setNote] = useState("");
  const [date, setDate] = useState(new Date().toISOString().split("T")[0]);
  const [paymentAmounts, setPaymentAmounts] = useState<Record<string, string>>({});
  const [paymentNotes, setPaymentNotes] = useState<Record<string, string>>({});
  const [paymentDates, setPaymentDates] = useState<Record<string, string>>({});
  const [isPending, startTransition] = useTransition();

  const totals = useMemo(() => {
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

  const resetForm = () => {
    setEditingId(null);
    setDirection("GIVEN");
    setPersonName("");
    setPrincipal("");
    setInterestRate("0");
    setNote("");
    setDate(new Date().toISOString().split("T")[0]);
    setShowForm(false);
  };

  const startEdit = (loan: Loan) => {
    setEditingId(loan.id);
    setDirection(loan.direction);
    setPersonName(loan.personName);
    setPrincipal(String(loan.principal));
    setInterestRate(String(loan.interestRate));
    setNote(loan.note || "");
    setDate(loan.date.slice(0, 10));
    setShowForm(true);
  };

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();

    startTransition(async () => {
      if (editingId) {
        const res = await updateLoan(editingId, {
          direction,
          personName,
          principal,
          interestRate,
          note,
          date,
        });

        if (res.success && res.loan) {
          toast.success("Loan updated");
          setLoans((prev) =>
            prev.map((loan) =>
              loan.id === editingId
                ? {
                    ...res.loan,
                    date: res.loan.date instanceof Date ? res.loan.date.toISOString() : String(res.loan.date),
                    payments: res.loan.payments.map((payment) => ({
                      ...payment,
                      date: payment.date instanceof Date ? payment.date.toISOString() : String(payment.date),
                    })),
                  }
                : loan
            )
          );
          resetForm();
        } else {
          toast.error(res.error || "Failed to update loan");
        }
        return;
      }

      const formData = new FormData();
      formData.append("direction", direction);
      formData.append("personName", personName);
      formData.append("principal", principal);
      formData.append("interestRate", interestRate);
      formData.append("note", note);
      formData.append("date", date);

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
        resetForm();
      } else {
        toast.error(res.error || "Failed to create loan");
      }
    });
  };

  const handleDelete = (id: string) => {
    if (!confirm("Delete this loan and its repayments?")) return;

    startTransition(async () => {
      const res = await deleteLoan(id);
      if (res.success) {
        toast.success("Loan deleted");
        setLoans((prev) => prev.filter((loan) => loan.id !== id));
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
          prev.map((loan) =>
            loan.id === loanId
              ? {
                  ...loan,
                  status: "OPEN",
                  payments: loan.payments.filter((payment) => payment.id !== paymentId),
                }
              : loan
          )
        );
      } else {
        toast.error(res.error || "Failed to delete repayment");
      }
    });
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        {[
          { label: "Loan Receivable", value: totals.receivable, icon: HandCoins, tone: "text-income" },
          { label: "Loan Payable", value: totals.payable, icon: Banknote, tone: "text-expense" },
          { label: "Total Given", value: totals.loanGiven, icon: ReceiptText, tone: "text-primary" },
          { label: "Total Taken", value: totals.loanTaken, icon: Banknote, tone: "text-primary" },
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
                resetForm();
                setShowForm(true);
              }}
              className="app-button-primary flex items-center gap-2 text-xs"
            >
              <Plus className="h-4 w-4" /> Add Loan
            </button>
          </div>
        </div>

        {showForm && (
          <form onSubmit={handleSubmit} className="app-panel mt-6 grid grid-cols-1 gap-4 p-5 md:grid-cols-3">
            <div>
              <label className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Direction</label>
              <div className="flex rounded-xl bg-muted p-0.5">
                {["GIVEN", "TAKEN"].map((item) => (
                  <button
                    key={item}
                    type="button"
                    onClick={() => setDirection(item)}
                    className={`flex-1 rounded-lg py-2 text-xs font-bold transition-colors ${
                      direction === item ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    {item === "GIVEN" ? "Given" : "Taken"}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Person</label>
              <input className="app-input text-xs" required value={personName} onChange={(event) => setPersonName(event.target.value)} placeholder="Name" />
            </div>
            <div>
              <label className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Principal</label>
              <input className="app-input text-xs" required min="0.01" step="0.01" type="number" value={principal} onChange={(event) => setPrincipal(event.target.value)} placeholder="5000" />
            </div>
            <div>
              <label className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Interest %</label>
              <input className="app-input text-xs" min="0" step="0.01" type="number" value={interestRate} onChange={(event) => setInterestRate(event.target.value)} />
            </div>
            <div>
              <label className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Date</label>
              <DateInput className="text-xs" value={date} onChange={(event) => setDate(event.target.value)} />
            </div>
            <div>
              <label className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Note</label>
              <input className="app-input text-xs" value={note} onChange={(event) => setNote(event.target.value)} placeholder="Optional" />
            </div>
            <div className="flex gap-2 md:col-span-3 md:justify-end">
              <button type="button" onClick={resetForm} className="rounded-xl border border-border px-4 py-2 text-xs font-semibold text-foreground hover:bg-muted">
                Cancel
              </button>
              <button type="submit" disabled={isPending} className="app-button-primary text-xs">
                {editingId ? "Save Loan" : "Record Loan"}
              </button>
            </div>
          </form>
        )}
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
                  <button onClick={() => startEdit(loan)} className="rounded-lg p-2 text-muted-foreground hover:bg-muted hover:text-primary" title="Edit loan">
                    <Pencil className="h-4 w-4" />
                  </button>
                  <button onClick={() => handleDelete(loan.id)} className="rounded-lg p-2 text-muted-foreground hover:bg-destructive/10 hover:text-destructive" title="Delete loan">
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
