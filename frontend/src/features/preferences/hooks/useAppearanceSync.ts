"use client";

import { useEffect } from "react";
import { THEME_STORAGE_KEY } from "@/design/theme-script";
import { useAppStore, type ThemePreference } from "@/store/app.store";

const isTheme = (value: string | null): value is ThemePreference => value === "light" || value === "dark" || value === "system";

export function useAppearanceSync() {
  useEffect(() => {
    const restore = () => {
      let theme = useAppStore.getState().theme;
      try {
        const stored = localStorage.getItem(THEME_STORAGE_KEY);
        if (isTheme(stored)) theme = stored;
      } catch {
        // Blocked storage still permits a theme choice for the current tab.
      }
      useAppStore.getState().setTheme(theme);
    };
    const unsubscribe = useAppStore.persist.onFinishHydration(restore);
    if (useAppStore.persist.hasHydrated()) restore();

    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const followSystem = () => {
      if (useAppStore.getState().theme === "system") useAppStore.getState().setTheme("system");
    };
    media.addEventListener("change", followSystem);
    return () => {
      unsubscribe();
      media.removeEventListener("change", followSystem);
    };
  }, []);
}
