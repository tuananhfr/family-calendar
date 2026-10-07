"use client";

import * as RSelect from "@radix-ui/react-select";
import { Check, ChevronDown } from "lucide-react";
import { t } from "@/i18n/vi";
import { cn } from "../cn";
import { Field, controlClass } from "./Field";

export interface SelectOption {
  value: string;
  label: string;
}

export interface SelectProps {
  label: string;
  options: SelectOption[];
  value?: string;
  onValueChange: (v: string) => void;
  placeholder?: string;
  helper?: string;
  error?: string;
  required?: boolean;
  disabled?: boolean;
  hideLabel?: boolean;
  className?: string;
}

export function Select({ label, options, value, onValueChange, placeholder = t("ui.selectPlaceholder"), helper, error, required, disabled, hideLabel, className }: SelectProps) {
  const trigger = (control?: { id: string; "aria-describedby"?: string; "aria-invalid"?: true }) => (
    <RSelect.Root value={value ?? ""} onValueChange={onValueChange} disabled={disabled} required={required}>
      <RSelect.Trigger {...control} aria-label={hideLabel ? label : undefined} className={cn(controlClass, "inline-flex items-center justify-between gap-2 text-left data-[placeholder]:text-muted", className)}>
        <span className="min-w-0 truncate">
          <RSelect.Value placeholder={placeholder} />
        </span>
        <RSelect.Icon>
          <ChevronDown aria-hidden className="size-4 shrink-0 text-muted" />
        </RSelect.Icon>
      </RSelect.Trigger>
      <RSelect.Portal>
        <RSelect.Content position="popper" sideOffset={4} className="z-50 max-h-72 min-w-[var(--radix-select-trigger-width)] overflow-hidden rounded-control border border-border bg-surface shadow-pop">
          <RSelect.Viewport className="p-1">
            {options.map((o) => (
              <RSelect.Item key={o.value} value={o.value} className="relative flex min-h-10 cursor-pointer select-none items-center rounded-[8px] py-2 pl-8 pr-3 text-sm text-text outline-none data-[highlighted]:bg-primary-soft data-[highlighted]:text-primary">
                <RSelect.ItemIndicator className="absolute left-2">
                  <Check aria-hidden className="size-4" />
                </RSelect.ItemIndicator>
                <RSelect.ItemText>{o.label}</RSelect.ItemText>
              </RSelect.Item>
            ))}
          </RSelect.Viewport>
        </RSelect.Content>
      </RSelect.Portal>
    </RSelect.Root>
  );
  if (hideLabel) return trigger();
  return (
    <Field label={label} helper={helper} error={error} required={required}>
      {(control) => trigger(control)}
    </Field>
  );
}
