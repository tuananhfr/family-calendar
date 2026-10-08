"use client";

import { useEffect } from "react";
import { THEME_STORAGE_KEY } from "@/design/theme-script";
import { useAppStore, type ThemePreference } from "@/store/app.store";

const isTheme = (value: string | null): value is ThemePreference => value === "light" || value === "dark";

export function useAppearanceSync() {
  useEffect(() => {
    const restore = () => {
      let theme = useAppStore.getState().theme;
      try {
        const stored = localStorage.getItem(THEME_STORAGE_KEY);
        if (stored !== null) theme = isTheme(stored) ? stored : "light";
      } catch {
        // Blocked storage still permits a theme choice for the current tab.
      }
      useAppStore.getState().setTheme(theme);
    };
    const unsubscribe = useAppStore.persist.onFinishHydration(restore);
    if (useAppStore.persist.hasHydrated()) restore();

    return unsubscribe;
  }, []);
}
