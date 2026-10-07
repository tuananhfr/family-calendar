import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { SENIOR_STORAGE_KEY, THEME_STORAGE_KEY } from "@/design/theme-script";

export type ThemePreference = "light" | "dark" | "system";

interface AppState {
  activeSpaceId?: string;
  memberFilter: string[] | "ALL";
  theme: ThemePreference;
  seniorMode: boolean;
  /** Member this device is mainly used by; drives Senior mode and "Việc của tôi". */
  usingMemberId?: string;
  setActiveSpaceId: (id: string | undefined) => void;
  setMemberFilter: (f: string[] | "ALL") => void;
  setTheme: (theme: ThemePreference) => void;
  setSeniorMode: (on: boolean) => void;
  setUsingMemberId: (id: string | undefined) => void;
}

function resolvedTheme(theme: ThemePreference): "light" | "dark" {
  if (theme !== "system") return theme;
  return typeof matchMedia === "function" && matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

// Theme and Senior also live under their own keys because the pre-hydration ThemeScript reads them to avoid a flash.
function writeAppearance(theme: ThemePreference, senior: boolean) {
  if (typeof document === "undefined") return;
  document.documentElement.dataset.theme = resolvedTheme(theme);
  if (senior) document.documentElement.dataset.senior = "true";
  else delete document.documentElement.dataset.senior;
  try {
    localStorage.setItem(THEME_STORAGE_KEY, theme);
    if (senior) localStorage.setItem(SENIOR_STORAGE_KEY, "1");
    else localStorage.removeItem(SENIOR_STORAGE_KEY);
  } catch {
    // Private mode or blocked storage: the attribute above still applies for this visit.
  }
}

export const useAppStore = create<AppState>()(
  persist(
    (set, get) => ({
      memberFilter: "ALL",
      theme: "system",
      seniorMode: false,
      setActiveSpaceId: (activeSpaceId) => set({ activeSpaceId, memberFilter: "ALL" }),
      setMemberFilter: (memberFilter) => set({ memberFilter }),
      setTheme: (theme) => {
        writeAppearance(theme, get().seniorMode);
        set({ theme });
      },
      setSeniorMode: (seniorMode) => {
        writeAppearance(get().theme, seniorMode);
        set({ seniorMode });
      },
      setUsingMemberId: (usingMemberId) => set({ usingMemberId }),
    }),
    {
      name: "fc.app",
      storage: createJSONStorage(() => localStorage),
      partialize: (s) => ({
        activeSpaceId: s.activeSpaceId,
        theme: s.theme,
        seniorMode: s.seniorMode,
        usingMemberId: s.usingMemberId,
      }),
    },
  ),
);
