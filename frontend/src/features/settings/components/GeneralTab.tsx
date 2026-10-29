"use client";
import { useState } from "react";
import type { Space, SpaceSettings } from "@/core/model/space";
import type { AccessContext } from "@/core/access/evaluate";
import { hasLevel } from "@/core/access/evaluate";
import { Button, Card, Checkbox, ForbiddenState, Select, SkeletonList, TextArea, TextField } from "@/design/components";
import { useAccess, useActiveSpace } from "@/features/members";
import { PROVINCES } from "@/features/weather/weather";
import { t } from "@/i18n/vi";
import { saveSpaceSettings } from "../model/space-settings";

function GeneralForm({ space, access }: { space: Space; access: AccessContext }) {
  const [name, setName] = useState(space.name);
  const [timeZone, setTimeZone] = useState(space.timeZone);
  const [settings, setSettings] = useState(space.settings);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const update = <K extends keyof SpaceSettings>(key: K, value: SpaceSettings[K]) => setSettings((current) => ({ ...current, [key]: value }));
  return <Card><form className="flex flex-col gap-4" onSubmit={async (e) => {
    e.preventDefault(); setBusy(true); setMessage("");
    try { await saveSpaceSettings(space, { name, timeZone, settings }, access); setMessage(t("settingsExtra.saved")); }
    catch { setMessage(t("settingsExtra.failed")); } finally { setBusy(false); }
  }}><h2 className="font-bold text-text">{t("settingsExtra.generalTitle")}</h2><div className="grid gap-4 sm:grid-cols-2"><TextField label={t("settingsExtra.name")} required maxLength={100} value={name} onChange={(e) => setName(e.target.value)} /><TextField label={t("settingsExtra.timeZone")} required maxLength={100} value={timeZone} onChange={(e) => setTimeZone(e.target.value)} /><Select label={t("settingsExtra.weekStarts")} value={String(settings.weekStartsOn)} onValueChange={(value) => update("weekStartsOn", value === "0" ? 0 : 1)} options={[{ value: "1", label: t("settingsExtra.monday") }, { value: "0", label: t("settingsExtra.sunday") }]} /><Select label={t("settingsExtra.dateFormat")} value={settings.dateFormat} onValueChange={(value) => update("dateFormat", value as SpaceSettings["dateFormat"])} options={[{ value: "dd/MM/yyyy", label: "dd/MM/yyyy" }, { value: "yyyy-MM-dd", label: "yyyy-MM-dd" }]} /><TextField label={t("settingsExtra.language")} value={t("settingsExtra.languageValue")} disabled /></div><TextArea label={t("settingsExtra.description")} optional value={settings.description ?? ""} maxLength={200} onChange={(e) => update("description", e.target.value)} />
    {(["showIllustrations", "showQuickReminders", "showUpcomingBirthdays", "weatherEnabled"] as const).map((key, index) => <Checkbox key={key} label={t(`settingsExtra.${["illustrations", "quickReminders", "birthdays", "weather"][index]}`)} checked={settings[key]} onCheckedChange={(value) => update(key, value)} />)}
    {settings.weatherEnabled && <><Select label={t("settingsExtra.city")} value={settings.weatherCity} onValueChange={(value) => update("weatherCity", value)} options={PROVINCES.map((province) => ({ value: province.key, label: province.name }))} /><p className="text-xs text-muted">{t("settingsExtra.weatherHint")}</p></>}
    <Button type="submit" loading={busy} disabled={!name.trim() || (settings.weatherEnabled && !settings.weatherCity)} className="self-start">{t("common.save")}</Button>{message && <p role="status" className="text-sm text-body">{message}</p>}
  </form></Card>;
}

export function GeneralTab() {
  const { space } = useActiveSpace(); const access = useAccess();
  if (!space || !access) return <SkeletonList rows={3} />;
  if (!hasLevel(access, "settings", "EDIT")) return <ForbiddenState />;
  return <GeneralForm key={space.id} space={space} access={access} />;
}
