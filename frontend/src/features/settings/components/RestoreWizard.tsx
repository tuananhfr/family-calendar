"use client";

import { useRef, useState } from "react";
import { AlertTriangle, FileUp, History, RotateCcw } from "lucide-react";
import { restoreBackup, type ConflictResolution, type RestoreMode } from "@/core/backup/restore";
import { validateBackup, type RestorePreview } from "@/core/backup/validate";
import { datePart, instantToZoned, timePart } from "@/core/time/zoned";
import { cn } from "@/design/cn";
import { Button, toast } from "@/design/components";
import { formatDateVi } from "@/features/items";
import { useActiveSpace } from "@/features/members";
import { t } from "@/i18n/vi";
import { SettingsPanel } from "./SettingsPanel";

type Step = { kind: "idle" } | { kind: "checking" } | { kind: "error"; message: string } | { kind: "preview"; file: File; preview: RestorePreview; spaceIds: string[] };

const COUNT_KEYS = ["members", "items", "reminderRules", "occurrenceStates", "templates", "files", "financeTxns", "healthMetrics"] as const;

function createdLabel(iso: string, timeZone: string): string {
  const local = instantToZoned(new Date(iso), timeZone);
  return `${formatDateVi(datePart(local))} ${timePart(local) ?? ""}`.trim();
}

function Choice({ checked, onSelect, label, hint }: { checked: boolean; onSelect: () => void; label: string; hint?: string }) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={checked}
      onClick={onSelect}
      className={cn(
        "flex min-h-[var(--touch-min)] flex-col items-start gap-0.5 rounded-control border px-4 py-2.5 text-left transition-colors",
        checked ? "border-primary bg-primary-soft" : "border-border bg-surface hover:border-primary",
      )}
    >
      <span className={cn("text-sm font-semibold", checked ? "text-primary" : "text-text")}>{label}</span>
      {hint ? <span className="text-xs text-muted">{hint}</span> : null}
    </button>
  );
}

/** Nothing is written until "Khôi phục": validation and preview only read the file (BKP-001). */
export function RestoreWizard({ onRestored, bare }: { onRestored?: () => void; bare?: boolean } = {}) {
  const { setActive } = useActiveSpace();
  const input = useRef<HTMLInputElement>(null);
  const [step, setStep] = useState<Step>({ kind: "idle" });
  const [mode, setMode] = useState<RestoreMode>("REPLACE");
  const [resolutions, setResolutions] = useState<Record<string, ConflictResolution>>({});
  const [busy, setBusy] = useState(false);

  const reset = () => {
    setStep({ kind: "idle" });
    setResolutions({});
    setMode("REPLACE");
    if (input.current) input.current.value = "";
  };

  const pick = async (file: File | undefined) => {
    if (!file) return;
    setStep({ kind: "checking" });
    const result = await validateBackup(file);
    if (!result.ok) {
      setStep({ kind: "error", message: result.message });
      return;
    }
    // Conflicts start as "keep what is on this device": the safe answer, shown and changeable before confirming.
    setResolutions(Object.fromEntries(result.preview.conflicts.map((c) => [c.key, "KEEP_LOCAL" as const])));
    setMode(result.preview.existingSpaceIds.length > 0 ? "REPLACE" : "MERGE");
    setStep({ kind: "preview", file, preview: result.preview, spaceIds: result.manifest.spaceIds });
  };

  const confirm = async () => {
    if (step.kind !== "preview") return;
    setBusy(true);
    try {
      const report = await restoreBackup(step.file, mode, mode === "MERGE" ? resolutions : {});
      if (!report.ok) {
        setStep({ kind: "error", message: report.message });
        return;
      }
      const n = Object.values(report.written).reduce((a, b) => a + b, 0);
      toast(t("settings.restore.done", { n }), "success");
      if (report.closedEmergencyCount > 0) toast(t("settings.restore.sosClosed", { n: report.closedEmergencyCount }));
      setActive(step.spaceIds[0]);
      reset();
      onRestored?.();
    } catch {
      toast(t("settings.restore.failed"), "error");
    } finally {
      setBusy(false);
    }
  };

  const filePicker = (
    <>
      <input ref={input} type="file" accept=".zip,application/zip" className="sr-only" aria-label={t("settings.restore.fileLabel")} onChange={(e) => void pick(e.target.files?.[0])} />
      <Button variant="secondary" className="self-start" icon={<FileUp className="size-4" />} onClick={() => input.current?.click()} loading={step.kind === "checking"}>
        {step.kind === "idle" || step.kind === "checking" ? t("settings.restore.pick") : t("settings.restore.another")}
      </Button>
    </>
  );

  const content = (
    <>
      {step.kind === "checking" ? (
        <p role="status" className="text-sm text-muted">
          {t("settings.restore.checking")}
        </p>
      ) : null}
      {step.kind === "error" ? (
        <p role="alert" className="flex items-start gap-2 rounded-control bg-danger-soft px-3 py-2 text-sm text-danger">
          <AlertTriangle aria-hidden className="mt-0.5 size-4 shrink-0" />
          {step.message}
        </p>
      ) : null}
      {step.kind === "preview" ? (
        <div className="flex flex-col gap-4 rounded-control border border-border bg-surface-2 p-4" data-testid="restore-preview">
          <div className="flex flex-col gap-0.5">
            <p className="text-sm font-bold text-text">{t("settings.restore.previewTitle", { spaces: step.preview.spaceNames.join(", ") })}</p>
            <p className="text-xs text-muted">{t("settings.restore.createdAt", { when: createdLabel(step.preview.createdAt, step.preview.timeZone) })}</p>
          </div>
          <dl className="grid grid-cols-2 gap-2 sm:grid-cols-4" aria-label={t("settings.restore.counts")}>
            {COUNT_KEYS.filter((k) => (step.preview.counts[k] ?? 0) > 0).map((k) => (
              <div key={k} className="flex flex-col rounded-control bg-surface px-3 py-2">
                <dt className="text-xs text-muted">{t(`settings.restore.countLabels.${k}`)}</dt>
                <dd className="text-lg font-bold text-text tabular-nums" data-count={k}>
                  {step.preview.counts[k]}
                </dd>
              </div>
            ))}
          </dl>
          {step.preview.privateCount + step.preview.sensitiveCount > 0 ? (
            <p className="text-sm text-body">{t("settings.restore.privateNote", { p: step.preview.privateCount, s: step.preview.sensitiveCount })}</p>
          ) : null}
          {step.preview.missingBlobCount > 0 ? <p className="text-sm text-muted">{t("settings.restore.missingBlobs", { n: step.preview.missingBlobCount })}</p> : null}

          {/* Replace vs merge only means something when this device already holds the backup's Space. */}
          {step.preview.existingSpaceIds.length > 0 ? (
            <div className="flex flex-col gap-1.5">
              <span id="restore-mode" className="text-sm font-semibold text-text">
                {t("settings.restore.modeLabel")}
              </span>
              <div role="radiogroup" aria-labelledby="restore-mode" className="grid gap-2 sm:grid-cols-2">
                <Choice checked={mode === "REPLACE"} onSelect={() => setMode("REPLACE")} label={t("settings.restore.REPLACE")} hint={t("settings.restore.REPLACEHint")} />
                <Choice checked={mode === "MERGE"} onSelect={() => setMode("MERGE")} label={t("settings.restore.MERGE")} hint={t("settings.restore.MERGEHint")} />
              </div>
            </div>
          ) : null}

          {mode === "MERGE" && step.preview.conflicts.length > 0 ? (
            <fieldset className="flex flex-col gap-2">
              <legend className="mb-1 text-sm font-semibold text-text">
                {t("settings.restore.conflictsTitle", { n: step.preview.conflicts.length })}
                <span className="block text-xs font-normal text-muted">{t("settings.restore.conflictsHint")}</span>
              </legend>
              <ul className="flex max-h-64 flex-col divide-y divide-border overflow-y-auto rounded-control border border-border bg-surface">
                {step.preview.conflicts.map((c) => (
                  <li key={c.key} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2">
                    <span className="min-w-0 break-words text-sm text-text">{c.label}</span>
                    <div role="radiogroup" aria-label={c.label} className="flex gap-1">
                      {(["KEEP_LOCAL", "USE_BACKUP"] as const).map((r) => (
                        <button
                          key={r}
                          type="button"
                          role="radio"
                          aria-checked={resolutions[c.key] === r}
                          onClick={() => setResolutions((s) => ({ ...s, [c.key]: r }))}
                          className={cn(
                            "rounded-chip border px-3 py-1 text-xs font-medium",
                            resolutions[c.key] === r ? "border-primary bg-primary-soft text-primary" : "border-border text-body hover:border-primary",
                          )}
                        >
                          {t(`settings.restore.${r}`)}
                        </button>
                      ))}
                    </div>
                  </li>
                ))}
              </ul>
            </fieldset>
          ) : null}

          {/* REPLACE clears the backup's own Space, which only matters when this device already has it. */}
          {mode === "REPLACE" && step.preview.existingSpaceIds.length > 0 ? (
            <p className="flex items-start gap-2 text-sm text-danger">
              <AlertTriangle aria-hidden className="mt-0.5 size-4 shrink-0" />
              {t("settings.restore.replaceWarn", { space: step.preview.spaceNames.join(", ") })}
            </p>
          ) : null}

          <div className="flex flex-wrap gap-2">
            <Button variant={mode === "REPLACE" ? "danger" : "primary"} icon={<RotateCcw className="size-4" />} onClick={() => void confirm()} loading={busy}>
              {t("settings.restore.confirm")}
            </Button>
            <Button variant="ghost" onClick={reset} disabled={busy}>
              {t("common.cancel")}
            </Button>
          </div>
        </div>
      ) : null}
      {step.kind === "preview" ? null : filePicker}
    </>
  );
  if (bare) return <div className="flex flex-col gap-4">{content}</div>;
  return (
    <SettingsPanel id="restore" icon={<History />} title={t("settings.restore.title")} body={t("settings.restore.body")}>
      {content}
    </SettingsPanel>
  );
}
