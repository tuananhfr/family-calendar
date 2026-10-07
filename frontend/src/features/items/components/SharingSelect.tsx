"use client";

import { scopesForSpace, type SharingScope, type SpaceKind } from "@/core/model/common";
import { Select } from "@/design/components";
import { t } from "@/i18n/vi";

export function SharingSelect({ value, onChange, spaceKind, error }: { value: SharingScope; onChange: (s: SharingScope) => void; spaceKind: SpaceKind; error?: string }) {
  return (
    <div data-field="sharingScope" data-invalid={error ? "true" : undefined}>
      <Select
        label={t("items.fields.sharing")}
        value={value}
        onValueChange={(v) => onChange(v as SharingScope)}
        options={scopesForSpace(spaceKind).map((s) => ({ value: s, label: t(`items.sharing.${s}`) }))}
        helper={value === "PRIVATE" ? t("items.fields.privateHint") : undefined}
        error={error}
      />
    </div>
  );
}
