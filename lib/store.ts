import { create } from "zustand";
import type { TransactionType } from "./types";

/**
 * UI-only state. Dexie is the source of truth for all data — nothing in this
 * store is persisted.
 */
interface UIState {
  quickEntryOpen: boolean;
  quickEntryType: TransactionType;
  /** When set, quick entry records a child expense into this withdrawal. */
  quickEntryParentId: string | null;
  openQuickEntry: (type?: TransactionType, parentId?: string | null) => void;
  closeQuickEntry: () => void;

  /** 0 = current month, -1 = previous month, … */
  monthOffset: number;
  setMonthOffset: (offset: number) => void;
}

export const useUIStore = create<UIState>((set) => ({
  quickEntryOpen: false,
  quickEntryType: "expense",
  quickEntryParentId: null,
  openQuickEntry: (type = "expense", parentId = null) =>
    set({
      quickEntryOpen: true,
      quickEntryType: type,
      quickEntryParentId: parentId,
    }),
  closeQuickEntry: () => set({ quickEntryOpen: false }),

  monthOffset: 0,
  setMonthOffset: (offset) => set({ monthOffset: offset }),
}));
