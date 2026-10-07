"use client";

import Link from "next/link";
import { Plus } from "lucide-react";
import { ROUTES } from "@/app-shell/nav-config";
import { Card, SectionCard } from "@/design/components";
import { MemberAvatar } from "@/features/members";
import { t } from "@/i18n/vi";
import type { HealthData } from "../hooks/useHealth";
import type { AppointmentRow, HealthTab, MedicationRow } from "../model/health-view";
import { latestMetrics } from "../model/metrics";
import { AppointmentList } from "./AppointmentList";
import { MedicationList } from "./MedicationList";
import { memberHealthLine } from "./member-line";
import { METRIC_ICON, METRIC_TONE } from "./metric-meta";

const LIST_LIMIT = 4;
const METRIC_LIMIT = 5;

export function HealthOverview({
  data,
  meds,
  appointments,
  names,
  tabHref,
  onMember,
}: {
  data: HealthData;
  meds: MedicationRow[];
  appointments: AppointmentRow[];
  names: Map<string, string>;
  tabHref: (tab: HealthTab) => string;
  onMember: (memberId: string) => void;
}) {
  const recent = latestMetrics(data.metrics, data.members).slice(0, METRIC_LIMIT);
  return (
    <div className="flex flex-col gap-5">
      <section aria-labelledby="health-members" className="flex flex-col gap-3">
        <h2 id="health-members" className="text-base font-bold text-text">
          {t("health.members.title")}
        </h2>
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5" data-testid="health-members">
          {data.members.map((m) => (
            <li key={m.id}>
              <button
                type="button"
                onClick={() => onMember(m.id)}
                className="flex h-full w-full flex-col items-center gap-2 rounded-card border border-border bg-surface px-3 py-4 text-center shadow-sm transition-colors hover:border-primary"
              >
                <MemberAvatar name={m.displayName} avatar={m.avatar} relationship={m.relationship} size="lg" />
                <span className="flex min-w-0 max-w-full flex-col">
                  <span className="truncate text-sm font-bold text-text">{m.displayName}</span>
                  <span className="truncate text-xs text-muted">
                    {memberHealthLine(
                      m,
                      data.profiles.find((p) => p.memberId === m.id),
                      data.today,
                    )}
                  </span>
                </span>
              </button>
            </li>
          ))}
          <li>
            <Link
              href={ROUTES.addMember}
              className="flex h-full min-h-32 w-full flex-col items-center justify-center gap-2 rounded-card border border-dashed border-border bg-surface px-3 py-4 text-center text-sm font-semibold text-primary hover:border-primary"
            >
              <span aria-hidden className="flex size-14 items-center justify-center rounded-full bg-primary-soft">
                <Plus className="size-6" />
              </span>
              {t("health.members.add")}
            </Link>
          </li>
        </ul>
      </section>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        <SectionCard title={t("health.meds.title")} seeAllHref={tabHref("meds")} className="min-w-0">
          {meds.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted">{t("health.meds.empty")}</p>
          ) : (
            <MedicationList rows={meds.slice(0, LIST_LIMIT)} names={names} canEdit={data.canEdit} compact />
          )}
        </SectionCard>
        <SectionCard title={t("health.appointments.title")} seeAllHref={tabHref("appointments")} className="min-w-0">
          {appointments.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted">{t("health.appointments.empty")}</p>
          ) : (
            <AppointmentList rows={appointments.slice(0, LIST_LIMIT)} names={names} />
          )}
        </SectionCard>
      </div>

      <section aria-labelledby="health-recent-metrics" className="flex flex-col gap-3">
        <h2 id="health-recent-metrics" className="text-base font-bold text-text">
          {t("health.metrics.title")}
        </h2>
        {recent.length === 0 ? (
          <Card>
            <p className="py-3 text-center text-sm text-muted">{t("health.metrics.empty")}</p>
          </Card>
        ) : (
          <ul className="grid grid-cols-1 gap-3 min-[420px]:grid-cols-2 md:grid-cols-3 xl:grid-cols-5" data-testid="recent-metrics">
            {recent.map((m) => {
              const Icon = METRIC_ICON[m.type];
              const tone = METRIC_TONE[m.type];
              return (
                <li key={`${m.memberId}-${m.type}-${m.customName ?? ""}`} className="flex min-w-0 items-center gap-3 rounded-card border border-border bg-surface p-3 shadow-sm">
                  <span
                    aria-hidden
                    className="flex size-10 shrink-0 items-center justify-center rounded-control [&_svg]:size-5"
                    style={{ background: `var(--cat-${tone}-bg)`, color: `var(--cat-${tone}-dot)` }}
                  >
                    <Icon />
                  </span>
                  <span className="flex min-w-0 flex-col">
                    <span className="truncate text-sm font-semibold text-text">{m.customName ?? t(`health.metrics.types.${m.type}`)}</span>
                    <span className="truncate text-xs tabular-nums text-body">{m.display}</span>
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
