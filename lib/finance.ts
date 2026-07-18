export const ACCOUNT_METHODS = [
  { value: "CASH", label: "Cash" },
  { value: "BANK", label: "Bank" },
  { value: "BKASH", label: "bKash" },
  { value: "NAGAD", label: "Nagad" },
  { value: "CARD", label: "Card" },
  { value: "OTHER", label: "Other" },
] as const;

export type AccountMethod = (typeof ACCOUNT_METHODS)[number]["value"];

const ACCOUNT_VALUES = new Set<string>(ACCOUNT_METHODS.map((method) => method.value));

export function normalizeAccount(value: unknown): AccountMethod {
  const normalized = String(value || "CASH").trim().toUpperCase();
  return ACCOUNT_VALUES.has(normalized) ? (normalized as AccountMethod) : "OTHER";
}

export function getAccountLabel(value: string): string {
  return ACCOUNT_METHODS.find((method) => method.value === value)?.label || value;
}
