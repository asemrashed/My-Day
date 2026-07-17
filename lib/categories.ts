export const DEFAULT_EXPENSE_CATEGORIES = [
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
  "Loan",
  "💸 Miscellaneous",
] as const;

export const DEFAULT_INCOME_CATEGORIES = [
  "Salary",
  "Freelance",
  "Side Project",
  "Loan",
  "Other",
] as const;

export type CategoryType = "EXPENSE" | "INCOME";

export function getDefaultCategories(type: CategoryType): string[] {
  return type === "EXPENSE"
    ? [...DEFAULT_EXPENSE_CATEGORIES]
    : [...DEFAULT_INCOME_CATEGORIES];
}

export function isDefaultCategory(type: CategoryType, name: string): boolean {
  return getDefaultCategories(type).includes(name);
}

export function mergeCategories(type: CategoryType, customNames: string[]): string[] {
  const defaults = getDefaultCategories(type);
  const seen = new Set(defaults.map((n) => n.toLowerCase()));
  const extras = customNames.filter((name) => {
    const key = name.trim().toLowerCase();
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
  return [...defaults, ...extras];
}
