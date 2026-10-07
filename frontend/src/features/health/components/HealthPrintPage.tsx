"use client";

import { useMemo } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { ArrowLeft, Printer } from "lucide-react";
import { DEFAULT_TIME_ZONE } from "@/core/model/common";
import { instantToZoned, timePart } from "@/core/time/zoned";
import { Button, buttonClass, EmptyState, ForbiddenState, Illustration, SkeletonList } from "@/design/components";
import { useActiveSpace } from "@/features/members";
import { t } from "@/i18n/vi";
import { useHealth } from "../hooks/useHealth";
import { upcomingAppointments, vnDate, vnDateTime } from "../model/health-view";
import { latestMetrics } from "../model/metrics";
import { Disclaimer } from "./Disclaimer";
import { memberHealthLine } from "./member-line";

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-2 print:break-inside-avoid">
      <h2 className="text-base font-bold text-text print:text-black">{title}</h2>
      {children}
    </section>
  );
}

function Lines({ rows, empty }: { rows: Array<[string, string]>; empty: string }) {
  if (rows.length === 0) return <p className="text-sm text-muted print:text-black/70">{empty}</p>;
  return (
    <table className="w-full text-sm">
      <tbody>
        {rows.map(([a, b], i) => (
          <tr key={i} className="border-b border-border last:border-0">
            <th scope="row" className="w-1/3 py-1.5 pr-3 text-left align-top font-medium text-body print:text-black">
              {a}
            </th>
            <td className="py-1.5 text-text print:text-black">{b}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

/** `/in/suc-khoe?tv=<memberId>`: one member's health summary for paper or "Lưu PDF". */
export function HealthPrintPage() {
  const params = useSearchParams();
  const { space } = useActiveSpace();
  const data = useHealth();
  const member = data.members.find((m) => m.id === params.get("tv"));
  const profile = member ? data.profiles.find((p) => p.memberId === member.id) : undefined;
  const now = instantToZoned(new Date(), space?.timeZone ?? DEFAULT_TIME_ZONE);

  const content = useMemo(() => {
    if (!member) return null;
    const mine = (ids: string[]) => ids.includes(member.id);
    const none = t("health.profile.none");
    return {
      profile: [
        [t("health.profile.bloodType"), profile?.bloodType ?? none],
        [t("health.profile.height"), profile?.heightCm ? String(profile.heightCm).replace(".", ",") : none],
        [t("health.profile.allergies"), profile?.allergies.join(", ") || none],
        [t("health.profile.conditions"), profile?.conditions.join(", ") || none],
        [t("health.profile.insurance"), profile?.insuranceNumber ?? none],
        [t("health.profile.emergencyNote"), profile?.emergencyNote ?? none],
      ] as Array<[string, string]>,
      // Today's dose wins over the series start: an override may have moved it.
      meds: data.medicationItems
        .filter((i) => mine(i.memberIds))
        .map((i) => {
          const dose = data.entries.find((e) => e.item.id === i.id && !e.occurrence.allDay);
          return [i.title, timePart(dose?.occurrence.start ?? i.schedule.start) ?? t("calendar.allDay")] as [string, string];
        }),
      appointments: upcomingAppointments(data.entries, data.today)
        .filter((r) => mine(r.item.memberIds))
        .map((r) => [vnDateTime(r.occurrence.start), r.occurrence.title ?? r.item.title] as [string, string]),
      metrics: latestMetrics(data.metrics, [member]).map(
        (m) => [m.customName ?? t(`health.metrics.types.${m.type}`), `${m.display.slice(member.displayName.length + 2)} · ${vnDate(m.measuredAt.slice(0, 10))}`] as [string, string],
      ),
      notes: data.notes
        .filter((n) => n.memberId === member.id)
        .sort((a, b) => (a.date < b.date ? 1 : -1))
        .map((n) => [vnDate(n.date), n.body ? `${n.title}: ${n.body}` : n.title] as [string, string]),
    };
  }, [member, profile, data]);

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-4xl flex-col gap-5 bg-bg px-4 py-6 print:max-w-none print:bg-white print:p-0 print:text-black">
      <div className="flex flex-wrap items-center justify-between gap-2 print:hidden">
        <Link href="/suc-khoe/?tab=report" className={buttonClass("ghost")}>
          <ArrowLeft aria-hidden className="size-4" />
          {t("health.report.back")}
        </Link>
        {data.forbidden || !member ? null : (
          <Button icon={<Printer className="size-4" />} onClick={() => window.print()}>
            {t("print.print")}
          </Button>
        )}
      </div>
      <p role="note" className="rounded-control bg-warning-soft px-3 py-2 text-sm font-medium text-text print:hidden">
        {t("health.report.warning")}
      </p>
      <article className="flex flex-col gap-5 rounded-card border border-border bg-surface p-5 print:rounded-none print:border-0 print:p-0" data-testid="print-health">
        <header className="flex items-center justify-between gap-4 border-b border-border pb-3 print:border-black/30">
          <div className="flex min-w-0 flex-col">
            <h1 className="text-xl font-bold text-text sm:text-2xl print:text-2xl print:text-black">{t("health.report.printTitle", { name: member?.displayName ?? "" })}</h1>
            <p className="text-sm text-muted print:text-black/70">
              {member ? `${memberHealthLine(member, profile, data.today)} · ` : ""}
              {t("health.report.printedAt", { time: vnDateTime(now) })}
            </p>
          </div>
          <div className="hidden shrink-0 sm:block print:block">
            <Illustration name="logo" height={48} />
          </div>
        </header>
        {data.forbidden ? (
          <ForbiddenState body={t("health.forbidden")} />
        ) : data.loading ? (
          <SkeletonList rows={5} />
        ) : !member || !content ? (
          <EmptyState title={t("health.report.notFound")} />
        ) : (
          <>
            <Section title={t("health.tabs.profiles")}>
              <Lines rows={content.profile} empty={t("health.profile.empty")} />
            </Section>
            <Section title={t("health.report.meds")}>
              <Lines rows={content.meds} empty={t("health.meds.allEmpty")} />
            </Section>
            <Section title={t("health.report.appointments")}>
              <Lines rows={content.appointments} empty={t("health.appointments.empty")} />
            </Section>
            <Section title={t("health.report.metrics")}>
              <Lines rows={content.metrics} empty={t("health.metrics.empty")} />
            </Section>
            <Section title={t("health.profile.notes")}>
              <Lines rows={content.notes} empty={t("health.profile.notesEmpty")} />
            </Section>
          </>
        )}
        <Disclaimer />
      </article>
    </div>
  );
}
