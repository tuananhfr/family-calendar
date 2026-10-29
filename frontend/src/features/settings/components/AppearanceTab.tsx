"use client";
import { useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { db } from "@/core/db/db";
import { useAppStore } from "@/store/app.store";
import { Card, Checkbox, Select } from "@/design/components";
import { t } from "@/i18n/vi";

export function AppearanceTab() {
  const theme = useAppStore((state) => state.theme);
  const senior = useAppStore((state) => state.seniorMode);
  const system = useLiveQuery(async () => (await db.settings.get("appearance.followSystem"))?.value === true, []);
  const fontSize = useLiveQuery(async () => (await db.settings.get("appearance.fontSize"))?.value ?? 16, []);
  const [error, setError] = useState(false);
  return <Card className="flex flex-col gap-4"><Select label={t("settingsExtra.theme")} value={system ? "system" : theme} onValueChange={(value) => {
    void db.settings.put({ key: "appearance.followSystem", value: value === "system" }).then(() => { if (value !== "system") useAppStore.getState().setTheme(value === "dark" ? "dark" : "light"); }).catch(() => setError(true));
  }} options={[{ value: "light", label: t("preferences.theme.light") }, { value: "dark", label: t("preferences.theme.dark") }, { value: "system", label: t("settingsExtra.system") }]} /><Select label={t("settingsExtra.fontSize")} value={String(fontSize)} onValueChange={(value) => void db.settings.put({ key: "appearance.fontSize", value: Number(value) }).catch(() => setError(true))} options={[{ value: "16", label: t("settingsExtra.normalFont") }, { value: "18", label: t("settingsExtra.largeFont") }, { value: "20", label: t("settingsExtra.extraLargeFont") }]} /><Checkbox label={t("settingsExtra.senior")} checked={senior} onCheckedChange={(value) => useAppStore.getState().setSeniorMode(value)} />{error && <p role="alert" className="text-sm text-danger">{t("settingsExtra.failed")}</p>}</Card>;
}
