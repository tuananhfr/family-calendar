"use client";

import { useId, useState } from "react";
import { X } from "lucide-react";
import { controlClass } from "@/design/components";
import { cn } from "@/design/cn";
import { t } from "@/i18n/vi";

const MAX_INTERESTS = 5;

export function InterestsField({ value, onChange, error }: { value: string[]; onChange: (v: string[]) => void; error?: string }) {
  const id = useId();
  const [draft, setDraft] = useState("");
  const add = () => {
    const v = draft.trim();
    if (!v || value.includes(v) || value.length >= MAX_INTERESTS) return;
    onChange([...value, v]);
    setDraft("");
  };
  return (
    <div className="flex min-w-0 flex-col gap-1.5">
      <label htmlFor={id} className="text-sm font-semibold text-text">
        {t("members.form.interests")} <span className="font-normal text-muted">({t("common.optional")})</span>
      </label>
      {value.length ? (
        <ul className="flex flex-wrap gap-1.5">
          {value.map((i) => (
            <li key={i} className="inline-flex max-w-full items-center gap-1 rounded-chip bg-primary-soft py-1 pl-2.5 pr-1 text-xs font-medium text-primary">
              <span className="truncate">{i}</span>
              <button
                type="button"
                onClick={() => onChange(value.filter((x) => x !== i))}
                aria-label={t("members.form.interestRemove", { name: i })}
                className="flex size-5 items-center justify-center rounded-full hover:bg-primary hover:text-on-primary"
              >
                <X aria-hidden className="size-3" />
              </button>
            </li>
          ))}
        </ul>
      ) : null}
      <input
        id={id}
        value={draft}
        maxLength={30}
        disabled={value.length >= MAX_INTERESTS}
        placeholder={t("members.form.interestsPlaceholder")}
        aria-invalid={error ? true : undefined}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => {
          // isComposing: Vietnamese IMEs (Telex) send Enter while composing a syllable.
          if (e.key === "Enter" && !e.nativeEvent.isComposing) {
            e.preventDefault();
            add();
          }
        }}
        onBlur={add}
        className={cn(controlClass)}
      />
      {error ? <p className="text-xs font-medium text-danger">{error}</p> : null}
    </div>
  );
}
