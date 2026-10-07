import { create } from "zustand";
import type { ItemFormValues } from "../model/form-to-item";
import type { ItemType } from "../model/item-types";

export type EditorRequest =
  | { mode: "create"; variant: "addNew" | "reminder"; type?: ItemType; initial?: Partial<ItemFormValues>; templateKey?: string }
  | { mode: "edit"; itemId: string; occurrenceKey?: string }
  | { mode: "detail"; itemId: string; occurrenceKey: string };

interface ItemEditorState {
  request: EditorRequest | null;
  /** Bumped on every open so reopening the same request starts a fresh form. */
  seq: number;
  openCreate: (opts?: { variant?: "addNew" | "reminder"; type?: ItemType; initial?: Partial<ItemFormValues>; templateKey?: string }) => void;
  openEdit: (itemId: string, occurrenceKey?: string) => void;
  openDetail: (itemId: string, occurrenceKey: string) => void;
  close: () => void;
}

/** One editor/detail dialog for the whole app, opened from any screen (Today, Lịch, Việc, Nhắc…). */
export const useItemEditor = create<ItemEditorState>((set) => ({
  request: null,
  seq: 0,
  openCreate: (opts = {}) =>
    set((s) => ({ seq: s.seq + 1, request: { mode: "create", variant: opts.variant ?? (opts.type === "REMINDER" ? "reminder" : "addNew"), type: opts.type, initial: opts.initial, templateKey: opts.templateKey } })),
  openEdit: (itemId, occurrenceKey) => set((s) => ({ seq: s.seq + 1, request: { mode: "edit", itemId, occurrenceKey } })),
  openDetail: (itemId, occurrenceKey) => set((s) => ({ seq: s.seq + 1, request: { mode: "detail", itemId, occurrenceKey } })),
  close: () => set({ request: null }),
}));
