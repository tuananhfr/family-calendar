"use client";

import { useEffect, useRef } from "react";
import { X } from "lucide-react";
import type { Relationship } from "@/core/model/common";
import { controlClass, IconButton, TextField } from "@/design/components";
import { cn } from "@/design/cn";
import { t } from "@/i18n/vi";
import { MemberAvatar, relationshipLabel } from "@/features/members";

export interface DraftPerson {
  key: string;
  relationship: Relationship;
  displayName: string;
}

const PRESETS: Relationship[] = ["FATHER", "MOTHER", "SON", "DAUGHTER", "GRANDFATHER", "GRANDMOTHER", "GUARDIAN", "OTHER"];
// Parents and grandparents are usually called by the role itself; children need a real name.
const NAMED_BY_ROLE = new Set<Relationship>(["FATHER", "MOTHER", "GRANDFATHER", "GRANDMOTHER"]);

export function newPerson(relationship: Relationship, key: string): DraftPerson {
  return {
    key,
    relationship,
    displayName: NAMED_BY_ROLE.has(relationship) ? relationshipLabel(relationship) : "",
  };
}

export interface StepMembersProps {
  familyName: string;
  onFamilyName: (v: string) => void;
  people: DraftPerson[];
  onAdd: (r: Relationship) => void;
  onChange: (key: string, name: string) => void;
  onRemove: (key: string) => void;
  error?: string;
  showNameErrors: boolean;
}

export function StepMembers({ familyName, onFamilyName, people, onAdd, onChange, onRemove, error, showNameErrors }: StepMembersProps) {
  const lastKey = useRef<string | null>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const newest = people.at(-1);
  useEffect(() => {
    // Focus only rows added just now, and only if they still need a name.
    if (newest && newest.key !== lastKey.current) {
      if (lastKey.current !== null && !newest.displayName) listRef.current?.querySelector<HTMLInputElement>(`[data-person="${newest.key}"]`)?.focus();
      lastKey.current = newest.key;
    }
  }, [newest]);

  return (
    <div className="flex flex-col gap-5">
      <TextField label={t("onboarding.familyName")} required maxLength={100} value={familyName} onChange={(e) => onFamilyName(e.target.value)} />
      <div>
        <h2 className="text-lg font-bold text-text">{t("onboarding.members.title")}</h2>
        <p className="mt-1 text-sm text-muted">{t("onboarding.members.body")}</p>
      </div>
      <div role="group" aria-labelledby="onb-add-people" className="flex flex-col gap-2">
        <span id="onb-add-people" className="text-sm font-semibold text-text">
          {t("onboarding.members.addLabel")}
        </span>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {PRESETS.map((r) => (
            <button
              key={r}
              type="button"
              onClick={() => onAdd(r)}
              className="flex min-h-[var(--touch-min)] items-center gap-2 rounded-control border border-border bg-surface px-2.5 text-left text-sm font-medium text-body transition-colors hover:border-primary hover:bg-primary-soft hover:text-primary active:translate-y-px"
            >
              <MemberAvatar name={relationshipLabel(r)} relationship={r} size="sm" />
              <span className="min-w-0 flex-1 truncate">{relationshipLabel(r)}</span>
            </button>
          ))}
        </div>
      </div>
      {people.length ? (
        <ul ref={listRef} className="flex flex-col gap-2">
          {people.map((p) => {
            const missing = showNameErrors && !p.displayName.trim();
            const label = t("onboarding.members.nameLabel", {
              role: relationshipLabel(p.relationship).toLocaleLowerCase("vi"),
            });
            return (
              <li key={p.key} className="flex items-center gap-3 rounded-control border border-border bg-surface-2 p-2 pl-3">
                <MemberAvatar name={p.displayName || relationshipLabel(p.relationship)} relationship={p.relationship} size="md" />
                <label className="flex min-w-0 flex-1 flex-col gap-0.5">
                  <span className="text-xs font-semibold text-muted">{label}</span>
                  <input
                    data-person={p.key}
                    value={p.displayName}
                    maxLength={50}
                    autoComplete="off"
                    aria-invalid={missing ? true : undefined}
                    onChange={(e) => onChange(p.key, e.target.value)}
                    className={cn(controlClass, "min-h-10")}
                  />
                </label>
                <IconButton
                  label={t("onboarding.members.remove", {
                    name: p.displayName || relationshipLabel(p.relationship),
                  })}
                  icon={<X className="size-4" />}
                  onClick={() => onRemove(p.key)}
                />
              </li>
            );
          })}
        </ul>
      ) : null}
      {error ? (
        <p role="alert" className="text-sm font-medium text-danger">
          {error}
        </p>
      ) : null}
    </div>
  );
}
