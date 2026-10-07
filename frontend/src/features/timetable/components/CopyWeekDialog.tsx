"use client";

import { useMemo, useState } from "react";
import { Copy } from "lucide-react";
import type { Item } from "@/core/model/item";
import { addDays } from "@/core/time/local-date";
import { cn } from "@/design/cn";
import { Button, DateField, Dialog, toast } from "@/design/components";
import { weekRange, weekRangeLabel, type WeekRange } from "@/features/calendar";
import { saveNewItems } from "@/features/items";
import { useAccess } from "@/features/members";
import { t } from "@/i18n/vi";
import { copyWeek } from "../model/copy-week";

type Target = "NEXT" | "OTHER";

export function CopyWeekDialog({ open, onOpenChange, week, items, weekStartsOn }: { open: boolean; onOpenChange: (o: boolean) => void; week: WeekRange; items: Item[]; weekStartsOn: 0 | 1 }) {
  const access = useAccess();
  const [target, setTarget] = useState<Target>("NEXT");
  const [otherDate, setOtherDate] = useState(addDays(week.from, 14));
  const [saving, setSaving] = useState(false);
  const next = useMemo(() => weekRange(addDays(week.from, 7), weekStartsOn), [week.from, weekStartsOn]);
  const dest = useMemo(() => (target === "NEXT" ? next : weekRange(otherDate, weekStartsOn)), [target, next, otherDate, weekStartsOn]);
  const sameWeek = dest.from === week.from;
  // A preview with a throwaway actor: only the count is shown, the real copies are made on confirm.
  const count = useMemo(() => (sameWeek ? 0 : copyWeek(items, week.from, dest.from, { actorId: "preview" }).length), [items, week.from, dest.from, sameWeek]);

  const close = (o: boolean) => {
    if (!o) setTarget("NEXT");
    onOpenChange(o);
  };
  const confirm = async () => {
    if (!access?.actorId || count === 0) return;
    setSaving(true);
    try {
      const copies = copyWeek(items, week.from, dest.from, {
        actorId: access.actorId,
      });
      await saveNewItems(copies);
      toast(
        t("timetable.copy.done", {
          n: copies.length,
          range: weekRangeLabel(dest),
        }),
        "success",
      );
      close(false);
    } catch {
      toast(t("timetable.copy.failed"), "error");
    } finally {
      setSaving(false);
    }
  };

  const option = (value: Target, label: string) => (
    <button
      type="button"
      role="radio"
      aria-checked={target === value}
      onClick={() => setTarget(value)}
      className={cn(
        "flex min-h-[var(--touch-min)] items-center rounded-control border px-4 text-left text-sm font-medium transition-colors",
        target === value ? "border-primary bg-primary-soft text-primary" : "border-border bg-surface text-text hover:border-primary",
      )}
    >
      {label}
    </button>
  );

  return (
    <Dialog
      open={open}
      onOpenChange={close}
      title={t("timetable.copy.title")}
      description={t("timetable.copy.description", {
        range: weekRangeLabel(week),
      })}
      icon={<Copy />}
      size="sm"
      footer={
        <>
          <Button variant="ghost" onClick={() => close(false)}>
            {t("common.cancel")}
          </Button>
          <Button onClick={() => void confirm()} loading={saving} disabled={count === 0}>
            {t("timetable.copy.confirm", { n: count })}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-1.5">
          <span id="copy-target" className="text-sm font-semibold text-text">
            {t("timetable.copy.target")}
          </span>
          <div role="radiogroup" aria-labelledby="copy-target" className="grid gap-2">
            {option("NEXT", t("timetable.copy.nextWeek", { range: weekRangeLabel(next) }))}
            {option("OTHER", t("timetable.copy.otherWeek"))}
          </div>
        </div>
        {target === "OTHER" ? (
          <DateField
            label={t("timetable.copy.otherDate")}
            value={otherDate}
            onChange={(e) => e.target.value && setOtherDate(e.target.value)}
            helper={weekRangeLabel(dest)}
            error={sameWeek ? t("timetable.copy.sameWeek") : undefined}
          />
        ) : null}
        <p role="status" className={cn("rounded-control px-3 py-2 text-sm", count > 0 ? "bg-primary-soft text-primary" : "bg-surface-2 text-muted")}>
          {sameWeek ? t("timetable.copy.sameWeek") : count > 0 ? t("timetable.copy.preview", { n: count }) : t("timetable.copy.nothing")}
        </p>
      </div>
    </Dialog>
  );
}
