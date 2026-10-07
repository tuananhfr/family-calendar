"use client";

import { useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { CalendarPlus, FileDown, HeartPulse, NotebookPen, Pill } from "lucide-react";
import { Card, ForbiddenState, PageHeader, ScriptText, SkeletonList, Tabs } from "@/design/components";
import { useItemEditor } from "@/features/items";
import { t } from "@/i18n/vi";
import { useHealth } from "../hooks/useHealth";
import { HEALTH_TABS, isHealthTab, todayMedications, upcomingAppointments, type HealthTab } from "../model/health-view";
import { AppointmentsTab } from "./AppointmentsTab";
import { Disclaimer } from "./Disclaimer";
import { HealthDialogs, type HealthDialog } from "./HealthDialogs";
import { HealthOverview } from "./HealthOverview";
import { HealthReportTab } from "./HealthReportTab";
import { MedicationTab } from "./MedicationTab";
import { MetricsTab } from "./MetricsTab";
import { ProfileTab } from "./ProfileTab";

function ActionTile({ icon, label, onClick }: { icon: React.ReactNode; label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex min-h-14 items-center justify-center gap-2.5 rounded-card border border-border bg-surface px-4 text-sm font-semibold text-primary shadow-sm transition-colors hover:border-primary hover:bg-primary-soft [&_svg]:size-5"
    >
      <span aria-hidden>{icon}</span>
      <span className="text-center">{label}</span>
    </button>
  );
}

/** `/suc-khoe` (IMG-F): members, today's doses, upcoming check-ups, readings and a per-member report. */
export function HealthPage() {
  const params = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const data = useHealth();
  const openCreate = useItemEditor((s) => s.openCreate);
  const [dialog, setDialog] = useState<HealthDialog | null>(null);

  const asked = params.get("tab");
  const tab: HealthTab = isHealthTab(asked) ? asked : "overview";
  const member = data.members.find((m) => m.id === params.get("tv")) ?? data.members[0];

  // Tab and member live in the URL so back/forward and a shared link land on the same view.
  const href = (next: { tab?: HealthTab; memberId?: string }) => {
    const q = new URLSearchParams(params.toString());
    const nextTab = next.tab ?? tab;
    if (nextTab === "overview") q.delete("tab");
    else q.set("tab", nextTab);
    if (next.memberId) q.set("tv", next.memberId);
    const qs = q.toString();
    return qs ? `${pathname}?${qs}` : pathname;
  };
  const go = (next: { tab?: HealthTab; memberId?: string }) => router.replace(href(next), { scroll: false });

  const meds = useMemo(() => todayMedications(data.entries, data.today, data.now), [data.entries, data.today, data.now]);
  const appointments = useMemo(() => upcomingAppointments(data.entries, data.today), [data.entries, data.today]);
  const names = useMemo(() => new Map(data.members.map((m) => [m.id, m.displayName])), [data.members]);

  const header = <PageHeader title={t("health.title")} subtitle={t("health.subtitle")} icon={<HeartPulse />} illustration="corner-health" />;
  if (data.forbidden)
    return (
      <div className="flex flex-col gap-5">
        {header}
        <Card>
          <ForbiddenState body={t("health.forbidden")} />
        </Card>
      </div>
    );

  const open = (d: HealthDialog) => setDialog(d);
  const onMember = (memberId: string) => go({ memberId });
  const body =
    data.loading || !member ? (
      <SkeletonList rows={5} />
    ) : tab === "overview" ? (
      <HealthOverview data={data} meds={meds} appointments={appointments} names={names} tabHref={(x) => href({ tab: x })} onMember={(id) => go({ tab: "profiles", memberId: id })} />
    ) : tab === "profiles" ? (
      <ProfileTab data={data} member={member} onMember={onMember} open={open} />
    ) : tab === "meds" ? (
      <MedicationTab rows={meds} items={data.medicationItems} names={names} canEdit={data.canEdit} />
    ) : tab === "appointments" ? (
      <AppointmentsTab rows={appointments} names={names} canEdit={data.canEdit} today={data.today} />
    ) : tab === "metrics" ? (
      <MetricsTab key={member.id} data={data} member={member} onMember={onMember} open={open} />
    ) : (
      <HealthReportTab members={data.members} />
    );

  return (
    <div className="flex flex-col gap-5">
      {header}
      <Tabs label={t("health.tabsLabel")} value={tab} onValueChange={(v) => go({ tab: v as HealthTab })} items={HEALTH_TABS.map((x) => ({ value: x, label: t(`health.tabs.${x}`) }))} />
      <section aria-label={t(`health.tabs.${tab}`)} className="min-w-0">
        {body}
      </section>
      {tab === "overview" && !data.loading ? (
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {data.canEdit ? (
            <>
              <ActionTile icon={<NotebookPen />} label={t("health.note.add")} onClick={() => open({ kind: "note" })} />
              <ActionTile icon={<CalendarPlus />} label={t("health.appointments.add")} onClick={() => openCreate({ type: "EVENT", initial: { category: "HEALTH", date: data.today } })} />
              <ActionTile icon={<Pill />} label={t("health.meds.add")} onClick={() => openCreate({ type: "REMINDER", initial: { category: "HEALTH" } })} />
            </>
          ) : null}
          <ActionTile icon={<FileDown />} label={t("health.report.export")} onClick={() => go({ tab: "report" })} />
        </div>
      ) : null}
      <Disclaimer />
      <ScriptText className="self-center lg:hidden">{t("health.script")}</ScriptText>
      <HealthDialogs dialog={dialog} data={data} onClose={() => setDialog(null)} />
    </div>
  );
}
