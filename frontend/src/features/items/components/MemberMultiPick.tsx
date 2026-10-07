"use client";

import Link from "next/link";
import { Check, Plus } from "lucide-react";
import type { Member } from "@/core/model/member";
import { cn } from "@/design/cn";
import { Truncate } from "@/design/components";
import { MemberAvatar } from "@/features/members";
import { t } from "@/i18n/vi";

export interface MemberMultiPickProps {
  label: string;
  members: Member[];
  value: string[];
  onChange: (ids: string[]) => void;
  error?: string;
  required?: boolean;
  /** Following "+ Thêm" leaves the dialog, so the host closes it first. */
  onAddMember?: () => void;
}

export function MemberMultiPick({ label, members, value, onChange, error, required, onAddMember }: MemberMultiPickProps) {
  const toggle = (id: string) => onChange(value.includes(id) ? value.filter((v) => v !== id) : [...value, id]);
  return (
    <fieldset data-field="memberIds" data-invalid={error ? "true" : undefined} className="flex min-w-0 flex-col gap-1.5">
      <legend className="mb-1.5 text-sm font-semibold text-text">
        {label}
        {required ? (
          <span className="text-danger" aria-hidden>
            {" "}*
          </span>
        ) : null}
      </legend>
      <div className="flex flex-wrap gap-2">
        {members.map((m) => {
          const on = value.includes(m.id);
          return (
            <button
              key={m.id}
              type="button"
              aria-pressed={on}
              onClick={() => toggle(m.id)}
              className={cn(
                "relative flex w-[4.75rem] flex-col items-center gap-1 rounded-card border p-2 text-xs font-medium transition-colors",
                on ? "border-primary bg-primary-soft text-primary" : "border-border bg-surface text-body hover:border-primary",
              )}
            >
              <MemberAvatar name={m.displayName} avatar={m.avatar} relationship={m.relationship} size="md" />
              <Truncate text={m.displayName} className="w-full text-center" />
              {on ? (
                <span aria-hidden className="absolute right-1 top-1 flex size-4 items-center justify-center rounded-full bg-primary text-on-primary">
                  <Check className="size-3" strokeWidth={3} />
                </span>
              ) : null}
            </button>
          );
        })}
        <Link
          href="/thanh-vien/them/"
          onClick={onAddMember}
          className="flex w-[4.75rem] flex-col items-center justify-center gap-1 rounded-card border border-dashed border-border-strong p-2 text-xs font-medium text-primary hover:bg-primary-soft"
        >
          <span aria-hidden className="flex size-10 items-center justify-center rounded-full bg-primary-soft">
            <Plus className="size-5" />
          </span>
          {t("items.fields.addMember")}
        </Link>
      </div>
      {error ? <p className="text-xs font-medium text-danger">{error}</p> : null}
    </fieldset>
  );
}
