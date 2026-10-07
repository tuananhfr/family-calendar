"use client";

import { useState } from "react";
import { Plus, X } from "lucide-react";
import { controlClass, IconButton } from "@/design/components";
import { cn } from "@/design/cn";
import { t } from "@/i18n/vi";

export function ChecklistEditor({ value, onChange, error }: { value: string[]; onChange: (lines: string[]) => void; error?: string }) {
  const [draft, setDraft] = useState("");
  const add = () => {
    const text = draft.trim();
    if (!text) return;
    onChange([...value, text]);
    setDraft("");
  };
  return (
    <fieldset data-field="checklist" data-invalid={error ? "true" : undefined} className="flex min-w-0 flex-col gap-2">
      <legend className="mb-1.5 text-sm font-semibold text-text">
        {t("items.fields.checklist")} <span className="font-normal text-muted">({t("common.optional")})</span>
      </legend>
      {value.length ? (
        <ul className="flex flex-col gap-1.5">
          {value.map((line, i) => (
            <li key={`${i}-${line}`} className="flex items-center gap-2">
              <input
                aria-label={`${t("items.fields.checklist")} ${i + 1}`}
                value={line}
                maxLength={200}
                onChange={(e) => onChange(value.map((v, j) => (j === i ? e.target.value : v)))}
                className={cn(controlClass, "min-h-10")}
              />
              <IconButton label={t("items.fields.checklistRemove", { text: line })} icon={<X className="size-4" />} onClick={() => onChange(value.filter((_, j) => j !== i))} />
            </li>
          ))}
        </ul>
      ) : null}
      <div className="flex items-center gap-2">
        <input
          aria-label={t("items.fields.checklistAdd")}
          value={draft}
          maxLength={200}
          placeholder={t("items.fields.checklistPlaceholder")}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            // IME composition (Telex/VNI) also fires Enter; adding then would cut a Vietnamese word in half.
            if (e.key === "Enter" && !e.nativeEvent.isComposing) {
              e.preventDefault();
              add();
            }
          }}
          className={cn(controlClass, "min-h-10")}
        />
        <IconButton label={t("items.fields.checklistAdd")} icon={<Plus className="size-4" />} onClick={add} variant="soft" />
      </div>
      {error ? <p className="text-xs font-medium text-danger">{error}</p> : null}
    </fieldset>
  );
}
