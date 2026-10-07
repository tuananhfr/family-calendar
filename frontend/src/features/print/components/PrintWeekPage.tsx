"use client";

import { useMemo } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { ArrowLeft, Printer } from "lucide-react";
import { isLocalDate } from "@/core/time/local-date";
import { datePart, instantToZoned, timePart } from "@/core/time/zoned";
import { Button, buttonClass, Illustration, SkeletonList } from "@/design/components";
import { weekRange, weekRangeLabel } from "@/features/calendar";
import { formatDateVi, useOccurrences } from "@/features/items";
import { useActiveSpace, useMembers, useSpaceToday } from "@/features/members";
import { t } from "@/i18n/vi";
import { printWeek, type PrintRow } from "../model/print-week";

/** `/in?view=week&date=` — a paper/PDF week for the fridge; private and health items never print. */
export function PrintWeekPage() {
  const params = useSearchParams();
  const today = useSpaceToday();
  const { space } = useActiveSpace();
  const members = useMembers(space?.id);
  const asked = params.get("date");
  const anchor = asked && isLocalDate(asked) ? asked : today;
  const week = useMemo(() => weekRange(anchor, space?.settings.weekStartsOn ?? 1), [anchor, space?.settings.weekStartsOn]);
  const range = useMemo(() => ({ from: week.from, to: week.to }), [week]);
  const { entries, loading } = useOccurrences(range);
  const byDay = useMemo(() => printWeek(entries, week.days), [entries, week.days]);
  const names = useMemo(() => new Map((members ?? []).map((m) => [m.id, m.displayName])), [members]);
  const total = [...byDay.values()].reduce((n, rows) => n + rows.length, 0);
  const now = instantToZoned(new Date(), space?.timeZone ?? "Asia/Ho_Chi_Minh");
  const printedAt = `${formatDateVi(datePart(now))} ${timePart(now) ?? ""}`.trim();

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-4xl flex-col gap-5 bg-bg px-4 py-6 print:max-w-none print:bg-white print:p-0 print:text-black">
      <div className="flex flex-wrap items-center justify-between gap-2 print:hidden">
        <Link href="/lich/" className={buttonClass("ghost")}>
          <ArrowLeft aria-hidden className="size-4" />
          {t("print.back")}
        </Link>
        <Button icon={<Printer className="size-4" />} onClick={() => window.print()}>
          {t("print.print")}
        </Button>
      </div>

      <article className="flex flex-col gap-4 rounded-card border border-border bg-surface p-5 print:rounded-none print:border-0 print:p-0" data-testid="print-week">
        <header className="flex items-center justify-between gap-4 border-b border-border pb-3 print:border-black/30">
          <div className="flex min-w-0 flex-col">
            <h1 className="text-xl font-bold text-text sm:text-2xl print:text-2xl print:text-black">{t("print.heading", { range: weekRangeLabel(week) })}</h1>
            {space ? <p className="text-sm text-muted print:text-black/70">{space.name}</p> : null}
          </div>
          {/* On a phone the logo would squeeze the heading into one word per line. */}
          <div className="hidden shrink-0 sm:block print:block">
            <Illustration name="logo" height={48} />
          </div>
        </header>

        {loading ? (
          <SkeletonList rows={5} />
        ) : total === 0 ? (
          <p className="py-6 text-center text-sm text-muted">{t("print.empty")}</p>
        ) : (
          <table className="w-full border-collapse text-sm">
            <tbody>
              {week.days.map((day) => {
                const rows = byDay.get(day) ?? [];
                return rows.length === 0 ? null : <DayRows key={day} day={day} rows={rows} names={names} />;
              })}
            </tbody>
          </table>
        )}

        <footer className="flex flex-wrap justify-between gap-2 border-t border-border pt-3 text-xs text-muted print:border-black/30 print:text-black/60">
          <span>{t("print.excluded")}</span>
          <span>{t("print.printedAt", { when: printedAt })}</span>
        </footer>
      </article>
    </div>
  );
}

function DayRows({ day, rows, names }: { day: string; rows: PrintRow[]; names: Map<string, string> }) {
  return (
    <>
      <tr className="break-inside-avoid">
        <th colSpan={3} scope="rowgroup" className="bg-surface-2 px-3 py-2 text-left text-sm font-bold text-text print:bg-black/5 print:text-black">
          {formatDateVi(day)}
        </th>
      </tr>
      {rows.map((r) => {
        const who = r.memberIds
          .map((id) => names.get(id))
          .filter(Boolean)
          .join(", ");
        return (
          <tr key={r.key} className="break-inside-avoid border-b border-border last:border-b-0 print:border-black/15">
            <td className="w-28 whitespace-nowrap px-3 py-2 align-top tabular-nums text-body print:text-black">{r.time ? (r.endTime ? `${r.time} – ${r.endTime}` : r.time) : t("print.allDay")}</td>
            <td className="px-3 py-2 align-top">
              <span className="font-semibold text-text print:text-black">{r.title}</span>
              {r.locationText ? <span className="block text-xs text-muted print:text-black/70">{r.locationText}</span> : null}
              {/* Narrow screens fold the member column under the title so the title keeps its width. */}
              {who ? <span className="block text-xs text-body sm:hidden print:hidden">{who}</span> : null}
            </td>
            <td className="hidden w-40 px-3 py-2 align-top text-body sm:table-cell print:table-cell print:text-black">{who}</td>
          </tr>
        );
      })}
    </>
  );
}
