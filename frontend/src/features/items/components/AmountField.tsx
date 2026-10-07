"use client";

import { TextField } from "@/design/components";
import { t } from "@/i18n/vi";

const group = (digits: string) => digits.replace(/\B(?=(\d{3})+(?!\d))/g, ".");

/** Integer VND typed as digits and shown grouped ("1.500.000"); anything else is dropped as it is typed. */
export function AmountField({ value, onChange, error }: { value?: number; onChange: (v: number | undefined) => void; error?: string }) {
  return (
    <div data-field="amount" data-invalid={error ? "true" : undefined}>
      <TextField
        label={t("items.fields.amount")}
        optional
        inputMode="numeric"
        autoComplete="off"
        value={value === undefined ? "" : group(String(value))}
        placeholder="1.500.000"
        helper={t("items.fields.amountHelper")}
        onChange={(e) => {
          const digits = e.target.value
            .replace(/\D/g, "")
            .replace(/^0+(?=\d)/, "")
            .slice(0, 15);
          onChange(digits ? Number(digits) : undefined);
        }}
        error={error}
      />
    </div>
  );
}
