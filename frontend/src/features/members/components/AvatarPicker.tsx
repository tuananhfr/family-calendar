"use client";

import { Avatar, type AvatarPreset } from "@/design/components";
import { cn } from "@/design/cn";
import { t } from "@/i18n/vi";
import { avatarValue, INITIALS_AVATAR } from "../model/avatar";

const OPTIONS: Array<{ key: string; preset?: AvatarPreset }> = [
  { key: "father", preset: "father" },
  { key: "mother", preset: "mother" },
  { key: "boy", preset: "boy" },
  { key: "girl", preset: "girl" },
  { key: "grandparent", preset: "grandfather" },
  { key: "guardian", preset: "guardian" },
  { key: "none" },
];

/** Preset illustration row from IMG-C; value is the Member.avatar string. */
export function AvatarPicker({ value, onChange, name }: { value?: string; onChange: (v: string) => void; name: string }) {
  return (
    <fieldset className="min-w-0">
      <legend className="mb-1.5 text-sm font-semibold text-text">{t("members.form.avatar")}</legend>
      <div role="radiogroup" className="flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none]">
        {OPTIONS.map((o) => {
          const v = o.preset ? avatarValue({ kind: "preset", preset: o.preset }) : INITIALS_AVATAR;
          const label = t(`members.form.avatarPresets.${o.key}`);
          const selected = value === v;
          return (
            <button
              key={o.key}
              type="button"
              role="radio"
              aria-checked={selected}
              aria-label={label}
              onClick={() => onChange(v)}
              className={cn(
                "flex w-[4.5rem] shrink-0 flex-col items-center gap-1 rounded-control border px-1 py-2 text-xs font-medium transition-colors",
                selected ? "border-primary bg-primary-soft text-primary" : "border-border bg-surface text-body hover:border-primary",
              )}
            >
              <Avatar name={name || label} preset={o.preset} size="md" />
              <span className="w-full truncate">{label}</span>
            </button>
          );
        })}
      </div>
    </fieldset>
  );
}
