"use client";

import { useRef, useState } from "react";
import { AlertTriangle, Download, FileUp, Upload } from "lucide-react";
import type { Member } from "@/core/model/member";
import type { LocalDate } from "@/core/time/local-date";
import { Button, DateField, Dialog, toast } from "@/design/components";
import { weekRange } from "@/features/calendar";
import { saveNewItems } from "@/features/items";
import { useAccess, useActiveSpace } from "@/features/members";
import { t } from "@/i18n/vi";
import { rowsToItems } from "../model/copy-week";
import { MAX_IMPORT_BYTES, parseTimetableCsv, parseTimetableXlsx, type ImportResult } from "../model/parse-import";
import { TIMETABLE_TEMPLATE_CSV } from "../model/timetable-filter";

const WEEKDAY_LABEL = ["", "Thứ 2", "Thứ 3", "Thứ 4", "Thứ 5", "Thứ 6", "Thứ 7", "Chủ nhật"];

type Stage = { kind: "pick"; error?: string } | { kind: "reading" } | { kind: "preview"; name: string; result: ImportResult };

async function readFile(file: File, members: Member[]): Promise<ImportResult | string> {
  const name = file.name.toLowerCase();
  const ctx = { members };
  // Checked before reading: a huge file must not be loaded into memory at all.
  if (file.size > MAX_IMPORT_BYTES) return t("timetable.import.tooLarge");
  if (name.endsWith(".csv")) return parseTimetableCsv(await file.text(), ctx);
  if (name.endsWith(".xlsx")) return parseTimetableXlsx(await file.arrayBuffer(), ctx);
  return t("timetable.import.unsupported");
}

function downloadTemplate() {
  // BOM so Excel opens the Vietnamese headers as UTF-8.
  const blob = new Blob(["﻿", TIMETABLE_TEMPLATE_CSV], {
    type: "text/csv;charset=utf-8",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "thoi-khoa-bieu-mau.csv";
  a.click();
  URL.revokeObjectURL(url);
}

export function ImportDialog({
  open,
  onOpenChange,
  members,
  defaultWeek,
  weekStartsOn,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  members: Member[];
  defaultWeek: LocalDate;
  weekStartsOn: 0 | 1;
}) {
  const { space } = useActiveSpace();
  const access = useAccess();
  const input = useRef<HTMLInputElement>(null);
  const [stage, setStage] = useState<Stage>({ kind: "pick" });
  const [weekStart, setWeekStart] = useState(defaultWeek);
  const [until, setUntil] = useState("");
  const [saving, setSaving] = useState(false);

  const reset = () => {
    setStage({ kind: "pick" });
    if (input.current) input.current.value = "";
  };
  const close = (o: boolean) => {
    if (!o) {
      reset();
      setUntil("");
      setWeekStart(defaultWeek);
    }
    onOpenChange(o);
  };
  const onFile = async (file: File | undefined) => {
    if (!file) return;
    setStage({ kind: "reading" });
    const res = await readFile(file, members);
    setStage(typeof res === "string" ? { kind: "pick", error: res } : { kind: "preview", name: file.name, result: res });
  };

  const preview = stage.kind === "preview" ? stage.result : undefined;
  const fileLevel = preview?.errors.find((e) => e.line === 0 || e.field === "header");
  const rows = preview?.rows ?? [];
  const lineErrors = preview?.errors.filter((e) => e !== fileLevel) ?? [];
  const untilInvalid = !!until && until < weekStart;

  const confirm = async () => {
    if (!space || !access?.actorId || rows.length === 0) return;
    setSaving(true);
    try {
      const items = rowsToItems(rows, {
        spaceId: space.id,
        actorId: access.actorId,
        timeZone: space.timeZone,
        weekStart: weekRange(weekStart, weekStartsOn).from,
        until: until || undefined,
        spaceKind: space.kind,
      });
      await saveNewItems(items);
      toast(t("timetable.import.done", { n: items.length }), "success");
      close(false);
    } catch {
      toast(t("timetable.import.failed"), "error");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={close}
      title={t("timetable.import.title")}
      description={t("timetable.import.description")}
      icon={<FileUp />}
      size="lg"
      footer={
        <>
          <Button variant="ghost" onClick={() => close(false)}>
            {t("common.cancel")}
          </Button>
          {preview ? (
            <Button variant="secondary" onClick={reset}>
              {t("timetable.import.another")}
            </Button>
          ) : null}
          {preview && rows.length > 0 ? (
            <Button onClick={() => void confirm()} loading={saving} disabled={untilInvalid}>
              {t("timetable.import.confirm", { n: rows.length })}
            </Button>
          ) : null}
        </>
      }
    >
      <input
        ref={input}
        type="file"
        accept=".csv,.xlsx,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        aria-label={t("timetable.import.pickLabel")}
        className="sr-only"
        tabIndex={-1}
        onChange={(e) => void onFile(e.target.files?.[0])}
      />
      {stage.kind !== "preview" ? (
        <div className="flex flex-col gap-4">
          <div className="flex flex-col items-center gap-3 rounded-card border-2 border-dashed border-border-strong bg-surface-2 px-4 py-8 text-center">
            <Upload aria-hidden className="size-8 text-primary" />
            <p className="max-w-prose text-sm text-body">{t("timetable.import.columns")}</p>
            <div className="flex flex-wrap justify-center gap-2">
              <Button icon={<FileUp className="size-4" />} onClick={() => input.current?.click()} loading={stage.kind === "reading"}>
                {stage.kind === "reading" ? t("timetable.import.reading") : t("timetable.import.pick")}
              </Button>
              <Button variant="secondary" icon={<Download className="size-4" />} onClick={downloadTemplate}>
                {t("timetable.import.template")}
              </Button>
            </div>
          </div>
          {stage.kind === "pick" && stage.error ? (
            <p role="alert" className="flex items-center gap-2 text-sm font-medium text-danger">
              <AlertTriangle aria-hidden className="size-4 shrink-0" />
              {stage.error}
            </p>
          ) : null}
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <p className="text-base font-bold text-text" role="status" data-testid="import-summary">
              {t("timetable.import.summary", {
                ok: rows.length,
                bad: preview!.errors.length,
              })}
            </p>
            <p className="min-w-0 truncate text-sm text-muted">{t("timetable.import.fileName", { name: stage.name })}</p>
          </div>
          {fileLevel ? (
            <p role="alert" className="flex items-center gap-2 rounded-control bg-danger-soft px-3 py-2 text-sm font-medium text-danger">
              <AlertTriangle aria-hidden className="size-4 shrink-0" />
              {t("timetable.import.fileError")}: {fileLevel.message}
            </p>
          ) : null}
          {lineErrors.length > 0 ? (
            <section aria-labelledby="import-errors" className="rounded-control border border-danger/40 bg-danger-soft px-3 py-2">
              <h3 id="import-errors" className="text-sm font-bold text-danger">
                {t("timetable.import.errorsTitle")}
              </h3>
              <ul className="mt-1 flex max-h-32 flex-col gap-0.5 overflow-y-auto text-sm text-text">
                {lineErrors.map((e) => (
                  <li key={`${e.line}-${e.field}`}>
                    <span className="font-semibold">{t("timetable.import.errorLine", { line: e.line })}:</span> {e.message}
                  </li>
                ))}
              </ul>
            </section>
          ) : null}
          {rows.length > 0 ? (
            <>
              <div className="max-h-64 overflow-auto rounded-control border border-border">
                <table className="w-full min-w-[32rem] text-left text-sm">
                  <caption className="sr-only">{t("timetable.import.previewTitle")}</caption>
                  <thead className="sticky top-0 bg-surface-2 text-xs font-semibold text-muted">
                    <tr>
                      <th scope="col" className="px-3 py-2">
                        {t("timetable.import.columnsHead.weekday")}
                      </th>
                      <th scope="col" className="px-3 py-2">
                        {t("timetable.import.columnsHead.time")}
                      </th>
                      <th scope="col" className="px-3 py-2">
                        {t("timetable.import.columnsHead.subject")}
                      </th>
                      <th scope="col" className="px-3 py-2">
                        {t("timetable.import.columnsHead.member")}
                      </th>
                      <th scope="col" className="px-3 py-2">
                        {t("timetable.import.columnsHead.category")}
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {rows.map((r) => (
                      <tr key={r.line}>
                        <td className="whitespace-nowrap px-3 py-1.5">{WEEKDAY_LABEL[r.weekday]}</td>
                        <td className="whitespace-nowrap px-3 py-1.5 tabular-nums">
                          {r.start} – {r.end}
                        </td>
                        <td className="px-3 py-1.5 font-medium text-text">{r.subject}</td>
                        <td className="px-3 py-1.5">{r.memberName}</td>
                        <td className="px-3 py-1.5">{t(`timetable.categories.${r.category}`)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <DateField label={t("timetable.import.weekStart")} value={weekStart} onChange={(e) => e.target.value && setWeekStart(e.target.value)} />
                <DateField
                  label={t("timetable.import.until")}
                  value={until}
                  min={weekStart}
                  onChange={(e) => setUntil(e.target.value)}
                  helper={t("timetable.import.untilHelp")}
                  error={untilInvalid ? t("timetable.import.untilBefore") : undefined}
                />
              </div>
            </>
          ) : null}
        </div>
      )}
    </Dialog>
  );
}
