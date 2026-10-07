"use client";

import { useState, type FormEvent } from "react";
import * as Popover from "@radix-ui/react-popover";
import { CalendarClock, ChevronDown, Zap } from "lucide-react";
import { DEFAULT_TIME_ZONE, scopesForSpace } from "@/core/model/common";
import { parseLocalDate, type LocalDate } from "@/core/time/local-date";
import { instantToZoned } from "@/core/time/zoned";
import { Button, Card, DateField, Select, TimeField, toast } from "@/design/components";
import { cn } from "@/design/cn";
import { controlClass } from "@/design/components/Field";
import { useItemMutations, type RepeatPreset } from "@/features/items";
import { useActiveSpace } from "@/features/members";
import { t } from "@/i18n/vi";
import { parseQuickReminder } from "../model/quick-reminder";

const REPEATS = ["NONE", "DAILY", "WEEKDAYS", "WEEKLY", "MONTHLY", "YEARLY"] as const;
type QuickRepeat = (typeof REPEATS)[number];

function whenLabel(date: LocalDate, time: string): string {
  const { day, month } = parseLocalDate(date);
  return `${time} ${day}/${month}`;
}

/** IMG-D "Nhắc nhanh": the text is the title as typed; date/time and repeat come from the two controls. */
export function QuickReminder() {
  const { space } = useActiveSpace();
  const mutations = useItemMutations();
  const [text, setText] = useState("");
  const [date, setDate] = useState<LocalDate | "">("");
  const [time, setTime] = useState("");
  const [repeat, setRepeat] = useState<QuickRepeat>("NONE");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const title = text.trim();
    if (!title) {
      setError(t("reminders.quick.empty"));
      return;
    }
    if (!space || !mutations.ready) return;
    const now = instantToZoned(new Date(), space.timeZone ?? DEFAULT_TIME_ZONE);
    const values = parseQuickReminder(title, now, { date: date || undefined, time: time || undefined, repeat: { kind: repeat } as RepeatPreset });
    // The quick form only knows family audiences; a group Space gets its own default scope.
    const scopes = scopesForSpace(space.kind);
    if (!scopes.includes(values.sharingScope)) values.sharingScope = scopes[0];
    setBusy(true);
    try {
      await mutations.create(values);
      toast(t("reminders.quick.added", { title, when: whenLabel(values.date, values.startTime ?? "") }), "success", 3000);
      setText("");
      setDate("");
      setTime("");
      setRepeat("NONE");
      setError(null);
    } catch {
      toast(t("reminders.failed"), "error");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card>
      <form onSubmit={submit} className="flex flex-col gap-3" aria-labelledby="quick-reminder-title" noValidate>
        <h2 id="quick-reminder-title" className="text-base font-bold text-text">
          {t("reminders.quick.title")}
        </h2>
        <div className="grid gap-2 lg:grid-cols-[minmax(0,1fr)_auto_12rem_auto] lg:items-start">
          <div className="flex flex-col gap-1">
            <label htmlFor="quick-reminder-text" className="sr-only">
              {t("reminders.quick.label")}
            </label>
            <input
              id="quick-reminder-text"
              value={text}
              maxLength={200}
              aria-invalid={error ? true : undefined}
              aria-describedby={error ? "quick-reminder-error" : undefined}
              onChange={(e) => {
                setText(e.target.value);
                if (error) setError(null);
              }}
              placeholder={t("reminders.quick.placeholder")}
              className={controlClass}
            />
            {error ? (
              <p id="quick-reminder-error" className="text-xs text-danger">
                {error}
              </p>
            ) : null}
          </div>
          <div className="grid grid-cols-2 gap-2 lg:contents">
            <Popover.Root>
              <Popover.Trigger aria-label={t("reminders.quick.whenLabel")} className={cn(controlClass, "inline-flex items-center justify-between gap-2 text-left lg:w-44")}>
                <span className="flex min-w-0 items-center gap-2">
                  <CalendarClock aria-hidden className="size-4 shrink-0 text-muted" />
                  <span className={cn("truncate", !time && !date && "text-muted")}>{time || date ? [time, date ? whenLabel(date, "").trim() : ""].filter(Boolean).join(" ") : t("reminders.quick.when")}</span>
                </span>
                <ChevronDown aria-hidden className="size-4 shrink-0 text-muted" />
              </Popover.Trigger>
              <Popover.Portal>
                <Popover.Content align="start" sideOffset={6} className="z-50 flex w-64 flex-col gap-3 rounded-control border border-border bg-surface p-3 shadow-pop">
                  <DateField label={t("reminders.quick.date")} value={date} onChange={(e) => setDate(e.target.value)} />
                  <TimeField label={t("reminders.quick.time")} value={time} onChange={(e) => setTime(e.target.value)} />
                  <Popover.Close className="self-end rounded-[8px] px-2 py-1 text-sm font-semibold text-primary">{t("common.close")}</Popover.Close>
                </Popover.Content>
              </Popover.Portal>
            </Popover.Root>
            <Select
              label={t("reminders.quick.repeat")}
              hideLabel
              value={repeat}
              onValueChange={(v) => setRepeat(v as QuickRepeat)}
              options={REPEATS.map((r) => ({ value: r, label: t(`reminders.repeatOptions.${r}`) }))}
            />
          </div>
          <Button type="submit" loading={busy} icon={<Zap className="size-4" />}>
            {t("reminders.quick.submit")}
          </Button>
        </div>
      </form>
    </Card>
  );
}
