"use client";

import { TextField } from "@/design/components";
import { groupDigits, parseMoneyInput } from "../model/finance-view";

/** Integer VND typed as digits and shown grouped ("4.100.000"); decimals are never guessed. */
export function MoneyField({
  label,
  value,
  onChange,
  error,
  required,
  autoFocus,
}: {
  label: string;
  value?: number;
  onChange: (v: number | undefined) => void;
  error?: string;
  required?: boolean;
  autoFocus?: boolean;
}) {
  return (
    <TextField
      label={label}
      required={required}
      autoFocus={autoFocus}
      inputMode="numeric"
      autoComplete="off"
      value={groupDigits(value)}
      placeholder="0"
      onChange={(e) => onChange(parseMoneyInput(e.target.value))}
      error={error}
      icon={<span className="text-sm font-semibold">đ</span>}
    />
  );
}
