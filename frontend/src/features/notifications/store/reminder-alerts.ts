import { create } from "zustand";

export interface ReminderAlert {
  /** triggerId(): the same trigger never stacks twice. */
  id: string;
  itemId: string;
  occurrenceKey: string;
  title: string;
  body: string;
  /** Local "HH:mm" the reminder was due, set only when it rings noticeably late (app was closed at the time). */
  lateSince?: string;
  /** Only set when the text is not the generic one, so a sensitive voice note is never offered aloud. */
  audioAssetId?: string;
}

interface ReminderAlertState {
  alerts: ReminderAlert[];
  push: (alert: ReminderAlert) => void;
  dismiss: (id: string) => void;
}

/** In-app alerts of this tab; only the tab holding the scanner lock ever pushes. */
export const useReminderAlerts = create<ReminderAlertState>((set) => ({
  alerts: [],
  push: (alert) => set((s) => (s.alerts.some((a) => a.id === alert.id) ? s : { alerts: [...s.alerts, alert] })),
  dismiss: (id) => set((s) => ({ alerts: s.alerts.filter((a) => a.id !== id) })),
}));
