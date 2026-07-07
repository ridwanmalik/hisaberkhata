/** Route paths — always use these, never hardcoded strings. */
export const ROUTES = {
  landing: "/",
  dashboard: "/dashboard",
  history: "/dashboard/history",
  budget: "/dashboard/budget",
  accounts: "/dashboard/accounts",
  accountStatement: (id: string) => `/dashboard/accounts/statement?id=${id}`,
  withdrawal: (id: string) => `/dashboard/withdrawal?id=${id}`,
  settings: "/dashboard/settings",
} as const;
