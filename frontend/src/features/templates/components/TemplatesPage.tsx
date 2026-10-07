"use client";

import type { ReactNode } from "react";
import { Bell, CalendarRange, Check, Clock, Lock, Repeat } from "lucide-react";
import { CATEGORY_META } from "@/design/categories";
import { Badge, Button, Card, PageHeader } from "@/design/components";
import { itemTypeOf, SYSTEM_TEMPLATES, useItemEditor, type TemplateDef } from "@/features/items";
import { useSpaceToday } from "@/features/members";
import { t } from "@/i18n/vi";
import { templateReminderLabel, templateTimeLabel } from "../model/template-summary";

const CHECKLIST_PREVIEW = 3;

/** `/mau-ke-hoach` (modules.md §15): picking a template opens the usual form prefilled; nothing is saved here. */
export function TemplatesPage() {
  const openCreate = useItemEditor((s) => s.openCreate);
  const today = useSpaceToday();
  const use = (tpl: TemplateDef) => openCreate({ type: itemTypeOf({ kind: tpl.kind, preset: tpl.preset }), templateKey: tpl.key, initial: { date: today } });

  return (
    <div className="flex flex-col gap-5">
      <PageHeader title={t("templates.title")} subtitle={t("templates.subtitle")} icon={<CalendarRange />} illustration="corner-add" />
      <ul aria-label={t("templates.listLabel")} className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
        {SYSTEM_TEMPLATES.map((tpl) => (
          <li key={tpl.key} className="flex min-w-0">
            <TemplateCard tpl={tpl} onUse={() => use(tpl)} />
          </li>
        ))}
      </ul>
      <p className="text-sm text-muted">{t("templates.note")}</p>
    </div>
  );
}

function TemplateCard({ tpl, onUse }: { tpl: TemplateDef; onUse: () => void }) {
  const meta = CATEGORY_META[tpl.category];
  const Icon = meta.icon;
  const type = itemTypeOf({ kind: tpl.kind, preset: tpl.preset });
  const typeLabel = t(`items.types.${type}.label`);
  const reminders = templateReminderLabel(tpl);
  const shown = tpl.checklist.slice(0, CHECKLIST_PREVIEW);
  const titleId = `template-${tpl.key}`;
  return (
    <Card className="flex w-full flex-col gap-4" data-testid="template-card" aria-labelledby={titleId} role="group">
      <div className="flex min-w-0 items-start gap-3">
        <span aria-hidden className="flex size-11 shrink-0 items-center justify-center rounded-card" style={{ background: `var(${meta.bgVar})` }}>
          <Icon className="size-5" style={{ color: `var(${meta.dotVar})` }} />
        </span>
        <div className="flex min-w-0 flex-1 flex-col gap-1.5">
          <h2 id={titleId} className="truncate text-base font-bold text-text">
            {tpl.title}
          </h2>
          <div className="flex flex-wrap gap-1.5">
            <Badge tone="primary">{typeLabel}</Badge>
            {meta.label !== typeLabel ? <Badge tone="neutral">{meta.label}</Badge> : null}
            {tpl.category === "HEALTH" ? (
              <Badge tone="neutral" icon={<Lock aria-hidden className="size-3" />}>
                {t("templates.private")}
              </Badge>
            ) : null}
          </div>
        </div>
      </div>
      <dl className="grid grid-cols-1 gap-1.5 text-sm text-body">
        <Fact icon={<Clock />} label={t("items.fields.time")} value={templateTimeLabel(tpl)} />
        <Fact icon={<Repeat />} label={t("items.fields.repeat")} value={t(`items.repeat.${tpl.repeat.kind}`)} />
        <Fact icon={<Bell />} label={t("templates.reminders")} value={reminders || t("templates.noReminder")} />
      </dl>
      {shown.length > 0 ? (
        <div className="flex flex-col gap-1">
          <p className="text-xs font-semibold text-muted">{t("templates.checklist")}</p>
          <ul className="flex flex-col gap-1 text-sm text-body">
            {shown.map((c) => (
              <li key={c} className="flex min-w-0 items-center gap-2">
                <Check aria-hidden className="size-3.5 shrink-0 text-success" />
                <span className="truncate">{c}</span>
              </li>
            ))}
            {tpl.checklist.length > shown.length ? <li className="pl-5.5 text-xs text-muted">{t("templates.checklistMore", { n: tpl.checklist.length - shown.length })}</li> : null}
          </ul>
        </div>
      ) : null}
      <Button variant="secondary" className="mt-auto self-start" onClick={onUse} aria-label={t("templates.useLabel", { title: tpl.title })}>
        {t("templates.use")}
      </Button>
    </Card>
  );
}

function Fact({ icon, label, value }: { icon: ReactNode; label: string; value: string }) {
  return (
    <div className="flex min-w-0 items-start gap-2">
      <dt className="flex shrink-0 items-center text-muted [&_svg]:size-4" title={label}>
        <span aria-hidden className="mt-0.5">
          {icon}
        </span>
        <span className="sr-only">{label}</span>
      </dt>
      <dd className="min-w-0">{value}</dd>
    </div>
  );
}
