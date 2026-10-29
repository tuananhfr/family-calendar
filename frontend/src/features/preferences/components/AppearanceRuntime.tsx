"use client";
import { useEffect } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { db } from "@/core/db/db";
import { useAppStore } from "@/store/app.store";
import { FONT_SIZE_STORAGE_KEY, SYSTEM_THEME_STORAGE_KEY } from "@/design/theme-script";

export function AppearanceRuntime() {
  const system = useLiveQuery(async () => (await db.settings.get("appearance.followSystem"))?.value === true, []);
  const fontSize = useLiveQuery(async () => (await db.settings.get("appearance.fontSize"))?.value ?? 16, []);
  useEffect(() => {
    if (system === undefined) return;
    const media = matchMedia("(prefers-color-scheme: dark)");
    const apply = () => { if (system) useAppStore.getState().setTheme(media.matches ? "dark" : "light"); };
    try { localStorage.setItem(SYSTEM_THEME_STORAGE_KEY, system ? "1" : "0"); } catch {}
    apply(); media.addEventListener("change", apply);
    return () => media.removeEventListener("change", apply);
  }, [system]);
  useEffect(() => {
    if (![16, 18, 20].includes(Number(fontSize))) return;
    document.documentElement.style.fontSize = `${fontSize}px`;
    try { localStorage.setItem(FONT_SIZE_STORAGE_KEY, String(fontSize)); } catch {}
  }, [fontSize]);
  return null;
}
