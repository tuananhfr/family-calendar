"use client";

import { useMemo } from "react";
import type { Member } from "@/core/model/member";
import { EmptyState } from "@/design/components";
import { weekRangeLabel, type WeekRange } from "@/features/calendar";
import { MemberAvatar } from "@/features/members";
import type { OccurrenceEntry } from "@/features/items";
import { t } from "@/i18n/vi";
import { weeklyHoursByMember } from "../model/timetable-report";

const fmt = (n: number) => n.toLocaleString("vi-VN", { maximumFractionDigits: 2 });

/** "Báo cáo" tab: study vs activity hours per member, bars scaled to the busiest member. */
export function TimetableReport({ lessons, week, members }: { lessons: OccurrenceEntry[]; week: WeekRange; members: Member[] }) {
  const rows = useMemo(() => {
    const byId = new Map(members.map((m) => [m.id, m]));
    return weeklyHoursByMember(
      lessons.map((e) => e.occurrence),
      lessons.map((e) => e.item),
      week.from,
    )
      .map((r) => ({
        ...r,
        member: byId.get(r.memberId),
        total: r.study + r.activity,
      }))
      .filter((r): r is typeof r & { member: Member } => !!r.member)
      .sort((a, b) => b.total - a.total);
  }, [lessons, week.from, members]);
  const max = Math.max(1, ...rows.map((r) => r.total));

  if (rows.length === 0) return <EmptyState title={t("timetable.report.empty")} illustration="corner-timetable" />;

  return (
    <section aria-labelledby="tt-report" className="flex flex-col gap-4 p-4 md:p-5">
      <h2 id="tt-report" className="text-base font-bold text-text">
        {t("timetable.report.title")} <span className="font-normal text-muted">· {weekRangeLabel(week)}</span>
      </h2>
      <table className="w-full text-sm" data-testid="timetable-report">
        <caption className="sr-only">{t("timetable.report.caption", { range: weekRangeLabel(week) })}</caption>
        <thead className="text-left text-xs font-semibold text-muted">
          <tr>
            <th scope="col" className="pb-2">
              {t("timetable.report.member")}
            </th>
            <th scope="col" className="hidden pb-2 md:table-cell">
              &nbsp;
            </th>
            <th scope="col" className="pb-2 text-right">
              {t("timetable.report.study")}
            </th>
            <th scope="col" className="pb-2 text-right">
              {t("timetable.report.activity")}
            </th>
            <th scope="col" className="pb-2 text-right">
              {t("timetable.report.total")}
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {rows.map((r) => (
            <tr key={r.memberId}>
              <th scope="row" className="py-3 pr-3 text-left font-semibold text-text">
                <span className="flex min-w-0 items-center gap-2">
                  <MemberAvatar name={r.member.displayName} avatar={r.member.avatar} relationship={r.member.relationship} size="sm" />
                  <span className="truncate">{r.member.displayName}</span>
                </span>
              </th>
              <td className="hidden w-[40%] py-3 pr-4 md:table-cell" aria-hidden>
                <span className="flex h-3 overflow-hidden rounded-full bg-surface-2">
                  <span
                    className="h-full"
                    style={{
                      width: `${(r.study / max) * 100}%`,
                      background: "var(--cat-study-dot)",
                    }}
                  />
                  <span
                    className="h-full"
                    style={{
                      width: `${(r.activity / max) * 100}%`,
                      background: "var(--cat-activity-dot)",
                    }}
                  />
                </span>
              </td>
              <td className="py-3 text-right tabular-nums">{t("timetable.report.hours", { n: fmt(r.study) })}</td>
              <td className="py-3 text-right tabular-nums">{t("timetable.report.hours", { n: fmt(r.activity) })}</td>
              <td className="py-3 text-right font-semibold tabular-nums text-text">{t("timetable.report.hours", { n: fmt(r.total) })}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}
