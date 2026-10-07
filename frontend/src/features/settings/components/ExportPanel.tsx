"use client";

import { useState } from "react";
import Link from "next/link";
import { CalendarArrowDown, Printer } from "lucide-react";
import { saveBlob } from "@/core/platform/download";
import { buttonClass, Button, toast } from "@/design/components";
import { useAccess, useActiveSpace, useSpaceToday } from "@/features/members";
import { t } from "@/i18n/vi";
import { buildSpaceIcs, icsFileName } from "../model/export-calendar";
import { SettingsPanel } from "./SettingsPanel";

export function ExportPanel() {
  const { space } = useActiveSpace();
  const access = useAccess();
  const today = useSpaceToday();
  const [busy, setBusy] = useState(false);

  const ics = async () => {
    if (!space || !access) return;
    setBusy(true);
    try {
      const { ics: text, events } = await buildSpaceIcs(space.id, access, space.name);
      saveBlob(new Blob([text], { type: "text/calendar;charset=utf-8" }), icsFileName(today));
      toast(t("settings.exportCal.icsDone", { n: events }), "success");
    } catch {
      toast(t("settings.backup.failed"), "error");
    } finally {
      setBusy(false);
    }
  };

  return (
    <SettingsPanel id="export" icon={<CalendarArrowDown />} title={t("settings.exportCal.title")} body={t("settings.exportCal.body")}>
      <div className="flex flex-wrap gap-2">
        <Button variant="secondary" icon={<CalendarArrowDown className="size-4" />} onClick={() => void ics()} loading={busy} disabled={!space || !access}>
          {t("settings.exportCal.ics")}
        </Button>
        <Link href={`/in/?view=week&date=${today}`} className={buttonClass("secondary")}>
          <Printer aria-hidden className="size-4" />
          {t("settings.exportCal.print")}
        </Link>
      </div>
    </SettingsPanel>
  );
}
