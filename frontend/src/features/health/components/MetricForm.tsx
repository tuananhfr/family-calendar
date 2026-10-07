"use client";

import { useState } from "react";
import { Activity } from "lucide-react";
import { HEALTH_METRIC_TYPES, HEALTH_METRIC_UNITS, type HealthMetricType } from "@/core/model/health";
import type { Member } from "@/core/model/member";
import type { LocalDateTime } from "@/core/time/zoned";
import { DateField, Select, TextField, TimeField } from "@/design/components";
import { t } from "@/i18n/vi";
import { parseMetricValues } from "../model/health-view";
import { HealthFormError, saveHealthMetric } from "../model/health-writes";
import { HealthFormDialog } from "./HealthFormDialog";

export function MetricForm({
  spaceId,
  members,
  now,
  memberId: initialMember,
  type: initialType = "WEIGHT",
  onClose,
}: {
  spaceId: string;
  members: Member[];
  now: LocalDateTime;
  memberId?: string;
  type?: HealthMetricType;
  onClose: () => void;
}) {
  const [memberId, setMemberId] = useState(initialMember ?? members[0]?.id ?? "");
  const [type, setType] = useState<HealthMetricType>(initialType);
  const [value, setValue] = useState("");
  const [customName, setCustomName] = useState("");
  const [unit, setUnit] = useState("");
  const [date, setDate] = useState(now.slice(0, 10));
  const [time, setTime] = useState(now.slice(11, 16));
  const [note, setNote] = useState("");
  const shownUnit = type === "CUSTOM" ? "" : HEALTH_METRIC_UNITS[type];

  return (
    <HealthFormDialog
      title={t("health.metrics.addTitle")}
      icon={<Activity />}
      submitLabel={t("health.metrics.save")}
      onClose={onClose}
      onSubmit={async () => {
        if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !/^\d{2}:\d{2}$/.test(time)) throw new HealthFormError({ measuredAt: "DATE" });
        const [v1, v2] = parseMetricValues(value, type);
        await saveHealthMetric(spaceId, {
          memberId,
          type,
          value: v1,
          ...(type === "BLOOD_PRESSURE" ? { value2: v2 } : {}),
          ...(type === "CUSTOM" ? { customName: customName.trim() || undefined, unit: unit.trim() || undefined } : {}),
          measuredAt: `${date}T${time}`,
          note: note.trim() || undefined,
        });
        return t("health.metrics.saved");
      }}
    >
      {(errors, clear) => (
        <>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Select
              label={t("health.metrics.member")}
              required
              value={memberId}
              onValueChange={setMemberId}
              options={members.map((m) => ({ value: m.id, label: m.displayName }))}
              error={errors.memberId}
            />
            <Select
              label={t("health.metrics.type")}
              required
              value={type}
              onValueChange={(v) => {
                setType(v as HealthMetricType);
                clear("value");
              }}
              options={HEALTH_METRIC_TYPES.map((x) => ({ value: x, label: t(`health.metrics.types.${x}`) }))}
            />
          </div>
          {type === "CUSTOM" ? (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <TextField
                label={t("health.metrics.customName")}
                required
                maxLength={50}
                value={customName}
                onChange={(e) => {
                  setCustomName(e.target.value);
                  clear("customName");
                }}
                error={errors.customName}
              />
              <TextField
                label={t("health.metrics.unit")}
                required
                maxLength={20}
                value={unit}
                onChange={(e) => {
                  setUnit(e.target.value);
                  clear("unit");
                }}
                error={errors.unit}
              />
            </div>
          ) : null}
          <TextField
            label={shownUnit ? t("health.metrics.value", { unit: shownUnit }) : t("health.metrics.valueCustom")}
            required
            autoFocus
            inputMode={type === "BLOOD_PRESSURE" ? "text" : "decimal"}
            placeholder={type === "BLOOD_PRESSURE" ? "120/80" : undefined}
            helper={type === "BLOOD_PRESSURE" ? t("health.metrics.valueHelperBp") : undefined}
            value={value}
            onChange={(e) => {
              setValue(e.target.value);
              clear("value");
              clear("value2");
            }}
            error={errors.value ?? errors.value2}
          />
          <div className="grid grid-cols-2 gap-4">
            <DateField
              label={t("health.metrics.measuredDate")}
              required
              value={date}
              onChange={(e) => {
                setDate(e.target.value);
                clear("measuredAt");
              }}
              error={errors.measuredAt}
            />
            <TimeField
              label={t("health.metrics.measuredTime")}
              required
              value={time}
              onChange={(e) => {
                setTime(e.target.value);
                clear("measuredAt");
              }}
            />
          </div>
          <TextField label={t("health.metrics.note")} optional maxLength={500} value={note} onChange={(e) => setNote(e.target.value)} error={errors.note} />
        </>
      )}
    </HealthFormDialog>
  );
}
