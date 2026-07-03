export interface Category {
  id: string;
  label: string;
  emoji: string;
}

export const EXPENSE_CATEGORIES: Category[] = [
  { id: "bazar", label: "Bazar", emoji: "🛒" },
  { id: "food", label: "Food", emoji: "🍛" },
  { id: "transport", label: "Transport", emoji: "🛺" },
  { id: "recharge", label: "Recharge", emoji: "📱" },
  { id: "utilities", label: "Utilities", emoji: "💡" },
  { id: "rent", label: "Rent", emoji: "🏠" },
  { id: "health", label: "Health", emoji: "💊" },
  { id: "education", label: "Education", emoji: "📚" },
  { id: "clothing", label: "Clothing", emoji: "👕" },
  { id: "family", label: "Family", emoji: "👪" },
  { id: "gifts", label: "Gifts", emoji: "🎁" },
  { id: "other", label: "Other", emoji: "🧾" },
];

export const INCOME_CATEGORIES: Category[] = [
  { id: "salary", label: "Salary", emoji: "💼" },
  { id: "business", label: "Business", emoji: "🏪" },
  { id: "gift", label: "Gift", emoji: "🎁" },
  { id: "other-income", label: "Other", emoji: "💰" },
];

const ALL = [...EXPENSE_CATEGORIES, ...INCOME_CATEGORIES];

export const categoryById = (id: string): Category =>
  ALL.find((c) => c.id === id) ?? { id, label: id, emoji: "🧾" };

export const categoryLabel = (id: string): string => categoryById(id).label;
export const categoryEmoji = (id: string): string => categoryById(id).emoji;
