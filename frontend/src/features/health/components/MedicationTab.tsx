"use client";

import { Pencil, Pill, Plus } from "lucide-react";
import type { Item } from "@/core/model/item";
import { Button, Card, EmptyState, IconButton } from "@/design/components";
import { useItemEditor } from "@/features/items";
import { t } from "@/i18n/vi";
import type { MedicationRow } from "../model/health-view";
import { MedicationList } from "./MedicationList";

/** "Lịch uống thuốc": today's doses with Đã uống / Bỏ qua, then every medication reminder to edit. */
export function MedicationTab({ rows, items, names, canEdit }: { rows: MedicationRow[]; items: Item[]; names: Map<string, string>; canEdit: boolean }) {
  const { openCreate, openEdit } = useItemEditor();
  const add = () => openCreate({ type: "REMINDER", initial: { category: "HEALTH" } });
  return (
    <div className="flex flex-col gap-5">
      <Card className="flex min-w-0 flex-col gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="min-w-[11rem] flex-1 text-base font-bold text-text">{t("health.meds.title")}</h2>
          {canEdit ? (
            <Button size="sm" icon={<Plus className="size-4" />} onClick={add}>
              {t("health.meds.add")}
            </Button>
          ) : null}
        </div>
        {rows.length === 0 ? <EmptyState title={t("health.meds.empty")} body={t("health.meds.emptyBody")} className="py-6" /> : <MedicationList rows={rows} names={names} canEdit={canEdit} />}
      </Card>
      <Card className="flex min-w-0 flex-col gap-2">
        <h2 className="text-base font-bold text-text">{t("health.meds.all")}</h2>
        {items.length === 0 ? (
          <p className="py-4 text-center text-sm text-muted">{t("health.meds.allEmpty")}</p>
        ) : (
          <ul className="flex flex-col divide-y divide-border">
            {items.map((item) => {
              const who = item.memberIds
                .map((id) => names.get(id))
                .filter(Boolean)
                .join(", ");
              return (
                <li key={item.id} className="flex items-center gap-3 py-2.5">
                  <span aria-hidden className="flex size-9 shrink-0 items-center justify-center rounded-full bg-[var(--cat-health-bg)] text-[var(--cat-health-dot)]">
                    <Pill className="size-4" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-text">{item.title}</p>
                    {who ? <p className="truncate text-xs text-muted">{who}</p> : null}
                  </div>
                  {canEdit ? <IconButton label={t("health.meds.edit", { title: item.title })} icon={<Pencil className="size-4" />} variant="ghost" onClick={() => openEdit(item.id)} /> : null}
                </li>
              );
            })}
          </ul>
        )}
      </Card>
    </div>
  );
}
