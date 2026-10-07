"use client";

import { useState } from "react";
import { Repeat } from "lucide-react";
import type { EditScope } from "@/core/recurrence/edit-scope";
import { cn } from "@/design/cn";
import { Button, Dialog } from "@/design/components";
import { t } from "@/i18n/vi";

const OPTIONS: { scope: EditScope; hint: string }[] = [
  { scope: "THIS", hint: "items.scope.thisHint" },
  { scope: "FOLLOWING", hint: "items.scope.followingHint" },
  { scope: "ALL", hint: "items.scope.allHint" },
];

/** "Chỉ lần này / Từ lần này / Cả chuỗi" before editing or deleting a recurring item. */
export function EditScopeDialog({ mode, onConfirm, onCancel, busy }: { mode: "edit" | "delete"; onConfirm: (s: EditScope) => void; onCancel: () => void; busy?: boolean }) {
  const [scope, setScope] = useState<EditScope>("THIS");
  return (
    <Dialog
      open
      onOpenChange={(o) => !o && onCancel()}
      size="sm"
      icon={<Repeat />}
      title={t(mode === "edit" ? "items.scope.editTitle" : "items.scope.deleteTitle")}
      description={t("items.scope.body")}
      footer={
        <>
          <Button variant="secondary" onClick={onCancel} disabled={busy}>
            {t("common.cancel")}
          </Button>
          <Button variant={mode === "delete" ? "danger" : "primary"} onClick={() => onConfirm(scope)} loading={busy}>
            {mode === "delete" ? t("common.delete") : t("items.scope.confirm")}
          </Button>
        </>
      }
    >
      <fieldset className="flex flex-col gap-2 pb-2">
        <legend className="sr-only">{t(mode === "edit" ? "items.scope.editTitle" : "items.scope.deleteTitle")}</legend>
        {OPTIONS.map((o) => (
          <label
            key={o.scope}
            className={cn(
              "flex min-h-[var(--touch-min)] cursor-pointer items-start gap-3 rounded-control border p-3",
              scope === o.scope ? "border-primary bg-primary-soft" : "border-border hover:border-primary",
            )}
          >
            <input type="radio" name="edit-scope" value={o.scope} checked={scope === o.scope} onChange={() => setScope(o.scope)} className="mt-1 size-4 accent-[var(--color-primary)]" />
            <span className="min-w-0">
              <span className="block text-sm font-semibold text-text">{t(`items.scope.${o.scope}`)}</span>
              <span className="block text-xs text-muted">{t(mode === "delete" && o.scope === "THIS" ? "items.scope.thisDeleteHint" : o.hint)}</span>
            </span>
          </label>
        ))}
      </fieldset>
    </Dialog>
  );
}
