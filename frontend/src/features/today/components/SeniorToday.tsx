"use client";

import { useState } from "react";
import Link from "next/link";
import { BellRing, Check, Phone, Siren, SkipForward, Undo2 } from "lucide-react";
import { ROUTES } from "@/app-shell/nav-config";
import type { OccurrenceStatus } from "@/core/model/occurrence";
import { timePart } from "@/core/time/zoned";
import { CATEGORY_META } from "@/design/categories";
import { Card, toast } from "@/design/components";
import { cn } from "@/design/cn";
import { useItemMutations, type OccurrenceAction, type OccurrenceEntry } from "@/features/items";
import { t } from "@/i18n/vi";
import type { TodayHeader } from "../model/greeting";
import { longDateVi } from "../model/date-label";

const STATE_LABEL: Partial<Record<OccurrenceStatus, string>> = {
  DONE: "today.senior.doneState",
  SKIPPED: "today.senior.skippedState",
  SNOOZED: "today.senior.snoozedState",
};

function isOpen(e: OccurrenceEntry): boolean {
  return e.state?.status !== "DONE" && e.state?.status !== "SKIPPED";
}

/** First open timed occurrence still ahead today, else the first open all-day one. */
export function nextUp(entries: OccurrenceEntry[], nowTime: string): OccurrenceEntry | undefined {
  const open = entries.filter(isOpen);
  return open.find((e) => !e.occurrence.allDay && (timePart(e.occurrence.end ?? e.occurrence.start) ?? "") >= nowTime) ?? open.find((e) => e.occurrence.allDay);
}

function ActionButtons({ entry }: { entry: OccurrenceEntry }) {
  const { act } = useItemMutations();
  const [busy, setBusy] = useState(false);
  const run = async (action: OccurrenceAction) => {
    setBusy(true);
    try {
      await act(entry.item.id, entry.occurrence.occurrenceKey, action);
    } catch {
      toast(t("today.actionFailed"), "error");
    } finally {
      setBusy(false);
    }
  };
  const base = "inline-flex min-h-14 items-center justify-center gap-2 rounded-control px-4 text-base font-semibold leading-tight disabled:opacity-60";
  if (!isOpen(entry)) {
    return (
      <button type="button" disabled={busy} onClick={() => void run("UNDO")} className={cn(base, "border border-border-strong bg-surface text-primary")}>
        <Undo2 aria-hidden className="size-5" />
        {t("today.senior.undo")}
      </button>
    );
  }
  return (
    <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
      <button type="button" disabled={busy} onClick={() => void run("DONE")} className={cn(base, "bg-success text-on-primary")}>
        <Check aria-hidden className="size-6" />
        {t("today.senior.done")}
      </button>
      <button type="button" disabled={busy} onClick={() => void run("SNOOZE")} className={cn(base, "border border-border-strong bg-surface text-primary")}>
        <BellRing aria-hidden className="size-5" />
        {t("today.senior.snooze")}
      </button>
      <button type="button" disabled={busy} onClick={() => void run("SKIP")} className={cn(base, "border border-border-strong bg-surface text-body")}>
        <SkipForward aria-hidden className="size-5" />
        {t("today.senior.skip")}
      </button>
    </div>
  );
}

function when(e: OccurrenceEntry): string {
  return e.occurrence.allDay ? t("today.board.allDay") : t("today.senior.at", { time: timePart(e.occurrence.start) ?? "" });
}

/** ui-ux.md "Chế độ Senior": only the next thing, today's reminders with big actions, and SOS / call. */
export function SeniorToday({ header, entries }: { header: TodayHeader; entries: OccurrenceEntry[] }) {
  const next = nextUp(entries, header.time);
  const reminders = entries.filter((e) => e.item.kind === "REMINDER" || e.item.kind === "TASK");
  return (
    <div className="flex flex-col gap-5" data-testid="senior-today">
      <header>
        <p className="text-xl font-medium text-primary">{header.greeting}</p>
        <h1 className="text-3xl font-extrabold text-text">{longDateVi(header.today)}</h1>
        <p className="text-base text-muted">{header.lunarLabel}</p>
        {header.timeZoneNote ? <p className="mt-1 text-base font-semibold text-text">{header.timeZoneNote}</p> : null}
      </header>

      <div className="grid grid-cols-2 gap-3">
        <Link href={ROUTES.sos} className="flex min-h-24 flex-col items-center justify-center gap-1 rounded-card border-2 border-danger bg-danger-soft px-2 py-3 text-center text-danger">
          <Siren aria-hidden className="size-7" />
          <span className="whitespace-nowrap text-lg font-extrabold leading-tight">{t("today.senior.sos")}</span>
          <span className="text-sm font-semibold leading-snug">{t("today.senior.sosHint")}</span>
        </Link>
        <Link href={ROUTES.members} className="flex min-h-24 flex-col items-center justify-center gap-1 rounded-card border-2 border-primary bg-primary-soft px-2 py-3 text-center text-primary">
          <Phone aria-hidden className="size-7" />
          <span className="whitespace-nowrap text-lg font-extrabold leading-tight">{t("today.senior.call")}</span>
          <span className="text-sm font-semibold leading-snug">{t("today.senior.callHint")}</span>
        </Link>
      </div>

      <section aria-labelledby="senior-next">
        <h2 id="senior-next" className="mb-2 text-xl font-bold text-text">
          {t("today.senior.next")}
        </h2>
        <Card className="flex flex-col gap-4">
          {next ? (
            <>
              <div className="flex items-start gap-3">
                {(() => {
                  const meta = CATEGORY_META[next.item.category];
                  const Icon = meta.icon;
                  return (
                    <span aria-hidden className="flex size-14 shrink-0 items-center justify-center rounded-card" style={{ background: `var(${meta.bgVar})` }}>
                      <Icon className="size-7" style={{ color: `var(${meta.dotVar})` }} />
                    </span>
                  );
                })()}
                <div className="min-w-0">
                  <p className="text-xl font-bold text-text">{next.occurrence.title ?? next.item.title}</p>
                  <p className="text-lg text-body">{when(next)}</p>
                </div>
              </div>
              <ActionButtons entry={next} />
            </>
          ) : (
            <p className="text-lg text-body">{t("today.senior.nextEmpty")}</p>
          )}
        </Card>
      </section>

      <section aria-labelledby="senior-reminders">
        <h2 id="senior-reminders" className="mb-2 text-xl font-bold text-text">
          {t("today.senior.reminders")}
        </h2>
        {reminders.length === 0 ? (
          <Card>
            <p className="text-lg text-body">{t("today.senior.remindersEmpty")}</p>
          </Card>
        ) : (
          <ul className="flex flex-col gap-3">
            {reminders.map((e) => {
              const state = e.state?.status ? STATE_LABEL[e.state.status] : undefined;
              return (
                <li key={e.occurrence.occurrenceKey}>
                  <Card className="flex flex-col gap-3">
                    <div>
                      <p className={cn("text-lg font-bold text-text", !isOpen(e) && "text-muted line-through")}>{e.occurrence.title ?? e.item.title}</p>
                      <p className="text-base tabular-nums text-body">{when(e)}</p>
                    </div>
                    {state ? <p className="text-base font-semibold text-success">{t(state)}</p> : null}
                    <ActionButtons entry={e} />
                  </Card>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
