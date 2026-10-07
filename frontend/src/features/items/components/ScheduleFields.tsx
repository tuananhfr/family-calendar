"use client";

import { solarToLunar } from "@/core/lunar/lunar";
import type { CalendarSystem } from "@/core/model/common";
import { isLocalDate } from "@/core/time/local-date";
import { cn } from "@/design/cn";
import { DateField, Switch, TimeField } from "@/design/components";
import { t } from "@/i18n/vi";
import { itemErrorText } from "../model/error-text";
import type { ItemFormValues } from "../model/form-to-item";
import type { ItemType } from "../model/item-types";

type Patch = (p: Partial<ItemFormValues>) => void;

function lunarHint(date: string): string | undefined {
  if (!isLocalDate(date)) return undefined;
  const l = solarToLunar(date);
  return t(l.leap ? "items.fields.lunarLeapDate" : "items.fields.lunarDate", { day: l.day, month: l.month });
}

function CalendarSystemToggle({ value, onChange }: { value: CalendarSystem; onChange: (c: CalendarSystem) => void }) {
  return (
    <div className="flex min-w-0 flex-col gap-1.5">
      <span id="item-calendar-system" className="text-sm font-semibold text-text">
        {t("items.fields.calendarSystem")}
      </span>
      <div role="radiogroup" aria-labelledby="item-calendar-system" className="grid grid-cols-2 gap-1 rounded-control border border-border-strong bg-surface p-1">
        {(["SOLAR", "LUNAR"] as const).map((c) => (
          <button
            key={c}
            type="button"
            role="radio"
            aria-checked={value === c}
            onClick={() => onChange(c)}
            className={cn("min-h-9 rounded-[8px] px-2 text-sm font-medium", value === c ? "bg-primary text-on-primary" : "text-body hover:bg-primary-soft")}
          >
            {t(`items.calendarSystem.${c}`)}
          </button>
        ))}
      </div>
    </div>
  );
}

/** Date/time block per type: events have a range + "Cả ngày", reminders one time, tasks a due day, special days a calendar system. */
export function ScheduleFields({ type, values, onChange, errors }: { type: ItemType; values: ItemFormValues; onChange: Patch; errors: Record<string, string | undefined> }) {
  const err = (k: string) => itemErrorText(errors[k]);
  const date = (
    <div data-field="date" data-invalid={errors.date ? "true" : undefined}>
      <DateField
        label={t(type === "TASK" ? "items.fields.dueDate" : type === "SPECIAL" ? "items.fields.specialDate" : "items.fields.date")}
        required
        value={values.date}
        onChange={(e) => onChange({ date: e.target.value })}
        error={err("date")}
        helper={type === "SPECIAL" && values.calendarSystem === "LUNAR" ? lunarHint(values.date) : undefined}
      />
    </div>
  );
  const start = (label: string) => (
    <div data-field="startTime" data-invalid={errors.startTime ? "true" : undefined}>
      <TimeField label={label} required value={values.startTime ?? ""} onChange={(e) => onChange({ startTime: e.target.value || undefined })} error={err("startTime")} />
    </div>
  );

  if (type === "REMINDER") {
    return (
      <div className="grid grid-cols-2 gap-3">
        {date}
        {start(t("items.fields.time"))}
      </div>
    );
  }
  if (type === "TASK") return date;
  if (type === "SPECIAL") {
    return (
      <div className="grid gap-3 sm:grid-cols-2">
        {date}
        <CalendarSystemToggle value={values.calendarSystem} onChange={(calendarSystem) => onChange({ calendarSystem })} />
      </div>
    );
  }
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-[minmax(0,1fr)_minmax(9.5rem,1fr)_minmax(9.5rem,1fr)_auto]">
      <div className="col-span-2 sm:col-span-1">{date}</div>
      {values.allDay ? null : (
        <>
          {start(t("items.fields.startTime"))}
          <div data-field="endTime" data-invalid={errors.endTime ? "true" : undefined}>
            <TimeField label={t("items.fields.endTime")} value={values.endTime ?? ""} onChange={(e) => onChange({ endTime: e.target.value || undefined })} error={err("endTime")} />
          </div>
        </>
      )}
      <div className={cn("flex flex-col gap-1.5", values.allDay ? "col-span-2 sm:col-span-3" : "col-span-2 sm:col-span-1")}>
        <span className="text-sm font-semibold text-text sm:text-center">{t("items.fields.allDay")}</span>
        <Switch
          hideLabel
          label={t("items.fields.allDay")}
          checked={values.allDay}
          onCheckedChange={(allDay) => onChange(allDay ? { allDay, startTime: undefined, endTime: undefined } : { allDay, startTime: "08:00", endTime: "09:00" })}
          className="sm:justify-center"
        />
      </div>
    </div>
  );
}
