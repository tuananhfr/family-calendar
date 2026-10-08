import { create } from "zustand";

export type DataMode = "local" | "shared" | "synced" | "pending" | "conflict" | "offline" | "blocked" | "authRequired" | "accountBacked";

interface ShellState {
  quickAddOpen: boolean;
  familySheetOpen: boolean;
  drawerOpen: boolean;
  /** Filled by the space/sync layer (Task 38); defaults describe a fresh LOCAL_ONLY install. */
  spaceName: string | null;
  dataMode: DataMode;
  pendingOps: number;
  tasksToday: number;
  setQuickAddOpen: (open: boolean) => void;
  setFamilySheetOpen: (open: boolean) => void;
  setDrawerOpen: (open: boolean) => void;
  setStatus: (patch: Partial<Pick<ShellState, "spaceName" | "dataMode" | "pendingOps" | "tasksToday">>) => void;
}

export const useShellStore = create<ShellState>((set) => ({
  quickAddOpen: false,
  familySheetOpen: false,
  drawerOpen: false,
  spaceName: null,
  dataMode: "local",
  pendingOps: 0,
  tasksToday: 0,
  setQuickAddOpen: (quickAddOpen) => set({ quickAddOpen }),
  setFamilySheetOpen: (familySheetOpen) => set({ familySheetOpen }),
  setDrawerOpen: (drawerOpen) => set({ drawerOpen }),
  setStatus: (patch) => set(patch),
}));
