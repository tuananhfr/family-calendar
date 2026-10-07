"use client";

import { useMemo, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { HEALTH_METRIC_TYPES, type HealthMetricType } from "@/core/model/health";
import type { Member } from "@/core/model/member";
import { Button, Card, ChipGroup, IconButton, Select } from "@/design/components";
import { t } from "@/i18n/vi";
import type { HealthData } from "../hooks/useHealth";
import { metricSeries, vnDateTime } from "../model/health-view";
import { formatMetricValue } from "../model/metrics";
import type { HealthDialog } from "./HealthDialogs";
import { MetricChart } from "./MetricChart";

/** "Chỉ số theo dõi": one member and one measure at a time, as a line chart plus the readings behind it. */
export function MetricsTab({ data, member, onMember, open }: { data: HealthData; member: Member; onMember: (id: string) => void; open: (d: HealthDialog) => void }) {
  // Start on a measure this member actually has, so the first view isn't an empty chart.
  const firstType = (HEALTH_METRIC_TYPES.find((x) => x !== "CUSTOM" && data.metrics.some((m) => m.memberId === member.id && m.type === x)) ?? "WEIGHT") as HealthMetricType;
  const [picked, setPicked] = useState<HealthMetricType | null>(null);
  const type = picked ?? firstType;
  const series = useMemo(() => metricSeries(data.metrics, member.id, type), [data.metrics, member.id, type]);
  const typeName = t(`health.metrics.types.${type}`);
  const newestFirst = [...series].reverse();

  return (
    <div className="flex flex-col gap-4">
      <ChipGroup label={t("health.members.title")} value={member.id} onChange={onMember} options={data.members.map((m) => ({ value: m.id, label: m.displayName }))} />
      <div className="flex flex-wrap items-end gap-3">
        <Select
          label={t("health.metrics.pick")}
          className="min-w-[12rem]"
          value={type}
          onValueChange={(v) => setPicked(v as HealthMetricType)}
          options={HEALTH_METRIC_TYPES.filter((x) => x !== "CUSTOM").map((x) => ({ value: x, label: t(`health.metrics.types.${x}`) }))}
        />
        {data.canEdit ? (
          <Button icon={<Plus className="size-4" />} onClick={() => open({ kind: "metric", memberId: member.id, type })}>
            {t("health.metrics.add")}
          </Button>
        ) : null}
      </div>
      <Card className="flex min-w-0 flex-col gap-3">
        <h2 className="text-base font-bold text-text">{t("health.metrics.chartTitle", { type: typeName.toLocaleLowerCase("vi"), name: member.displayName })}</h2>
        {series.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted">{t("health.metrics.chartEmpty", { type: typeName.toLocaleLowerCase("vi"), name: member.displayName })}</p>
        ) : (
          <MetricChart series={series} label={t("health.metrics.chartTitle", { type: typeName.toLocaleLowerCase("vi"), name: member.displayName })} />
        )}
      </Card>
      {series.length > 0 ? (
        <Card className="flex min-w-0 flex-col gap-2">
          <h2 className="text-base font-bold text-text">{t("health.metrics.history")}</h2>
          <ul className="flex flex-col divide-y divide-border" data-testid="metric-history">
            {newestFirst.map((m) => {
              const value = formatMetricValue(m);
              const at = vnDateTime(m.measuredAt);
              return (
                <li key={m.id} className="flex items-center gap-3 py-2.5">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-bold tabular-nums text-text">{value}</p>
                    <p className="truncate text-xs tabular-nums text-muted">
                      {at}
                      {m.note ? ` · ${m.note}` : ""}
                    </p>
                  </div>
                  {data.canEdit ? (
                    <IconButton
                      label={t("health.metrics.delete", { value })}
                      icon={<Trash2 className="size-4" />}
                      variant="ghost"
                      onClick={() => open({ kind: "delete", type: "health_metric", id: m.id, question: t("health.metrics.confirmDelete", { value, at }), done: t("health.metrics.deleted") })}
                    />
                  ) : null}
                </li>
              );
            })}
          </ul>
        </Card>
      ) : null}
    </div>
  );
}
