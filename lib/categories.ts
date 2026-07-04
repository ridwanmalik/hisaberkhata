import type { IconName } from "@/components/Icon";

export interface Category {
  id: string;
  label: string;
  /** Semantic name in the Icon registry (components/Icon.tsx). */
  icon: IconName;
}

export const EXPENSE_CATEGORIES: Category[] = [
  { id: "bazar", label: "Bazar", icon: "bazar" },
  { id: "food", label: "Food", icon: "food" },
  { id: "transport", label: "Transport", icon: "transport" },
  { id: "recharge", label: "Recharge", icon: "recharge" },
  { id: "utilities", label: "Utilities", icon: "utilities" },
  { id: "rent", label: "Rent", icon: "rent" },
  { id: "health", label: "Health", icon: "health" },
  { id: "education", label: "Education", icon: "education" },
  { id: "clothing", label: "Clothing", icon: "clothing" },
  { id: "personal-care", label: "Personal care", icon: "personal-care" },
  { id: "family", label: "Family", icon: "family" },
  { id: "pocket-money", label: "Pocket money", icon: "pocket-money" },
  { id: "charity", label: "Charity", icon: "charity" },
  { id: "gifts", label: "Gifts", icon: "gift" },
  { id: "fees", label: "Fees", icon: "fees" },
  { id: "other", label: "Other", icon: "receipt" },
];

export const INCOME_CATEGORIES: Category[] = [
  { id: "salary", label: "Salary", icon: "salary" },
  { id: "business", label: "Business", icon: "business" },
  { id: "gift", label: "Gift", icon: "gift" },
  { id: "other-income", label: "Other", icon: "coins" },
];

const ALL = [...EXPENSE_CATEGORIES, ...INCOME_CATEGORIES];

export const categoryById = (id: string): Category =>
  ALL.find((c) => c.id === id) ?? { id, label: id, icon: "receipt" };

export const categoryLabel = (id: string): string => categoryById(id).label;
export const categoryIcon = (id: string): IconName => categoryById(id).icon;
