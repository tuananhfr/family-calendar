"use client";

import { useEffect, useRef, useState } from "react";
import { Bell, Plus } from "lucide-react";
import { StorageFullError } from "@/core/db/errors";
import { scopesForSpace, type Category } from "@/core/model/common";
import type { Space } from "@/core/model/space";
import type { EditScope } from "@/core/recurrence/edit-scope";
import { instantToZoned } from "@/core/time/zoned";
import { Button, Checkbox, Dialog, SkeletonList, toast } from "@/design/components";
import { useMembers } from "@/features/members";
import { t } from "@/i18n/vi";
import { useItemMutations } from "../hooks/useItemMutations";
import { ItemFormError, type ItemFormValues } from "../model/form-to-item";
import { changeCategory, changeType, itemTypeOf, newFormValues, validateItemForm, type ItemType } from "../model/item-types";
import { loadItemForEdit } from "../model/item-writes";
import { applyTemplate, templateByKey, type TemplateDef } from "../model/templates";
import { CategoryRow, TYPE_ICON, TypeCards, TypeSectionHeader } from "./AddNewModal";
import { EditScopeDialog } from "./EditScopeDialog";
import { ItemForm } from "./ItemForm";
import { ReminderTypeTabs } from "./ReminderModal";
import { TemplatePanel } from "./TemplatePanel";

export type EditorTarget =
  | { mode: "create"; variant: "addNew" | "reminder"; type?: ItemType; initial?: Partial<ItemFormValues>; templateKey?: string }
  | { mode: "edit"; itemId: string; occurrenceKey?: string };

function initialValues(target: Extract<EditorTarget, { mode: "create" }>, space: Space): ItemFormValues {
  const now = instantToZoned(new Date(), space.timeZone);
  const type = target.type ?? (target.variant === "reminder" ? "REMINDER" : "EVENT");
  const { category, ...rest } = target.initial ?? {};
  const base = { ...newFormValues(type, { date: now.slice(0, 10), nowTime: now.slice(11, 16), spaceKind: space.kind }), ...rest };
  // A preset category must also bring its preset and privacy (HEALTH → PRIVATE), not just the label.
  const withCategory = category ? changeCategory(base, category, space.kind) : base;
  const tpl = target.templateKey ? templateByKey(target.templateKey) : undefined;
  if (!tpl) return withCategory;
  // The default next-slot time was not typed by anyone, so the template's own time must not lose to it.
  return withTemplate(tpl, { ...withCategory, startTime: rest.startTime, endTime: rest.endTime }, space);
}

/** Same rules as picking a template inside the form; an unknown or unusable template leaves the blank form. */
function withTemplate(tpl: TemplateDef, v: ItemFormValues, space: Space): ItemFormValues {
  let next: ItemFormValues;
  try {
    next = applyTemplate(tpl, v);
  } catch {
    return v;
  }
  return scopesForSpace(space.kind).includes(next.sharingScope) ? next : changeCategory(next, next.category, space.kind);
}

/** Moves focus to the first marked field so keyboard and screen-reader users land on the problem. */
function focusFirstInvalid(root: HTMLElement | null) {
  requestAnimationFrame(() => {
    const field = root?.querySelector<HTMLElement>('[data-invalid="true"]');
    if (!field) return;
    const target = field.matches("input,textarea,button") ? field : field.querySelector<HTMLElement>("input,textarea,button");
    target?.focus();
    target?.scrollIntoView({ block: "center" });
  });
}

export function ItemEditorDialog({ target, space, onClose }: { target: EditorTarget; space: Space; onClose: () => void }) {
  const members = useMembers(space.id) ?? [];
  const mutations = useItemMutations();
  const bodyRef = useRef<HTMLDivElement>(null);
  const [values, setValues] = useState<ItemFormValues | null>(() => (target.mode === "create" ? initialValues(target, space) : null));
  const [recurring, setRecurring] = useState(false);
  const [loadFailed, setLoadFailed] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [askScope, setAskScope] = useState(false);
  const [templatesOpen, setTemplatesOpen] = useState(false);

  const editId = target.mode === "edit" ? target.itemId : null;
  const editKey = target.mode === "edit" ? target.occurrenceKey : undefined;
  useEffect(() => {
    if (!editId) return;
    let live = true;
    loadItemForEdit(editId, editKey).then(
      (r) => {
        if (!live) return;
        setValues(r.values);
        setRecurring(r.recurring);
      },
      () => live && setLoadFailed(true),
    );
    return () => {
      live = false;
    };
  }, [editId, editKey]);

  const type = values ? itemTypeOf(values) : "EVENT";
  const isCreate = target.mode === "create";
  const variant = target.mode === "create" ? target.variant : type === "REMINDER" ? "reminder" : "addNew";

  const patch = (p: Partial<ItemFormValues>) => {
    setValues((v) => (v ? { ...v, ...p } : v));
    setErrors((e) => {
      const next = { ...e };
      for (const k of Object.keys(p)) delete next[k];
      if ("startTime" in p || "date" in p) delete next.endTime;
      return next;
    });
  };
  const setType = (next: ItemType) => {
    setValues((v) => (v ? changeType(v, next, space.kind) : v));
    setErrors({});
  };
  const setCategory = (c: Category) => setValues((v) => (v ? changeCategory(v, c, space.kind) : v));
  const pickTemplate = (tpl: TemplateDef) => {
    // Template audiences are family scopes; a group space needs its own scope set (withTemplate).
    setValues((v) => (v ? withTemplate(tpl, v, space) : v));
    setErrors({});
    setTemplatesOpen(false);
    toast(t("items.templates.appliedToast", { title: tpl.title }), "success");
  };

  const save = async (scope?: EditScope) => {
    if (!values) return;
    const found = validateItemForm(values, space.timeZone, space.kind);
    if (Object.keys(found).length > 0) {
      setErrors(found);
      focusFirstInvalid(bodyRef.current);
      return;
    }
    if (target.mode === "edit" && recurring && target.occurrenceKey && !scope) {
      setAskScope(true);
      return;
    }
    setSaving(true);
    try {
      if (target.mode === "edit") await mutations.update(target.itemId, values, scope ?? "ALL", target.occurrenceKey);
      else await mutations.create(values);
      toast(t("items.savedToast", { title: values.title.trim() }), "success");
      onClose();
    } catch (e) {
      setAskScope(false);
      if (e instanceof ItemFormError) {
        setErrors(e.fields);
        focusFirstInvalid(bodyRef.current);
      } else {
        toast(t(e instanceof StorageFullError ? "items.errors.STORAGE_FULL" : "items.errors.UNKNOWN"), "error");
      }
    } finally {
      setSaving(false);
    }
  };

  const TypeIcon = TYPE_ICON[type];
  const header =
    variant === "reminder" && isCreate
      ? { title: t("items.reminderModal.title"), description: t("items.reminderModal.subtitle"), icon: <Bell />, illustration: "corner-reminder-modal" as const }
      : isCreate
        ? { title: t("items.addNew.title"), description: t("items.addNew.subtitle"), icon: <Plus />, illustration: "corner-add" as const }
        : { title: t(`items.editTitle.${type}`), description: t("items.editSubtitle"), icon: <TypeIcon />, illustration: undefined };
  const sidePanel = variant === "addNew";
  const footerToggle =
    !values ? null : type === "REMINDER" ? (
      <Checkbox checked={values.showOnCalendar} onCheckedChange={(showOnCalendar) => patch({ showOnCalendar })} label={t("items.fields.showOnCalendar")} />
    ) : (
      <Checkbox checked={values.createReminder} onCheckedChange={(createReminder) => patch({ createReminder })} label={t(`items.fields.createReminder.${type}`)} />
    );

  return (
    <>
      <Dialog
        open={!askScope}
        onOpenChange={(o) => !o && onClose()}
        size={sidePanel ? "lg" : "md"}
        {...header}
        footer={
          values ? (
            <>
              <div className="mr-auto min-w-0 basis-full sm:basis-auto">{footerToggle}</div>
              <Button variant="secondary" onClick={onClose} disabled={saving}>
                {t("common.cancel")}
              </Button>
              <Button onClick={() => void save()} loading={saving} icon={<TypeIcon className="size-4" />}>
                {saving ? t("items.saving") : isCreate ? t(`items.save.${type}`) : t("items.saveChanges")}
              </Button>
            </>
          ) : undefined
        }
      >
        <div ref={bodyRef} className="flex flex-col gap-5 pb-2">
          {!values ? (
            loadFailed ? (
              <p className="py-8 text-center text-sm text-muted">{t("items.detail.notFound")}</p>
            ) : (
              <SkeletonList rows={3} />
            )
          ) : (
            <>
              {variant === "reminder" && isCreate ? <ReminderTypeTabs value={type} onChange={setType} /> : null}
              {variant === "addNew" && isCreate ? <TypeCards value={type} onChange={setType} /> : null}
              {variant === "addNew" && type !== "SPECIAL" ? <CategoryRow value={values.category} onChange={setCategory} /> : null}
              <div className={sidePanel ? "grid gap-6 lg:grid-cols-[minmax(0,1fr)_14rem]" : undefined}>
                <div className="flex min-w-0 flex-col gap-4">
                  {sidePanel ? <TypeSectionHeader type={type} /> : null}
                  <ItemForm
                    type={type}
                    values={values}
                    onChange={patch}
                    errors={errors}
                    members={members}
                    spaceKind={space.kind}
                    onLeave={onClose}
                    templates={isCreate ? { open: templatesOpen, onToggle: () => setTemplatesOpen((o) => !o), onPick: pickTemplate, inlineClassName: sidePanel ? "lg:hidden" : undefined } : undefined}
                  />
                </div>
                {sidePanel && isCreate ? <TemplatePanel onPick={pickTemplate} className="hidden self-start lg:block" /> : null}
              </div>
            </>
          )}
        </div>
      </Dialog>
      {askScope ? <EditScopeDialog mode="edit" busy={saving} onCancel={() => setAskScope(false)} onConfirm={(s) => void save(s)} /> : null}
    </>
  );
}
