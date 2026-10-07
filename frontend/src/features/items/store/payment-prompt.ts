import { create } from "zustand";

export interface PaymentPrompt {
  itemId: string;
  occurrenceKey: string;
  title: string;
  /** Integer VND from the reminder. */
  amount: number;
}

interface PaymentPromptState {
  prompt: PaymentPrompt | null;
  show: (p: PaymentPrompt) => void;
  clear: () => void;
}

/** modules.md §7: finishing a PAYMENT reminder with an amount asks "Ghi khoản chi này?"; the Finance feature answers. */
export const usePaymentPrompt = create<PaymentPromptState>((set) => ({
  prompt: null,
  show: (prompt) => set({ prompt }),
  clear: () => set({ prompt: null }),
}));
