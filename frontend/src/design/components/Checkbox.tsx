"use client";

import { useId, type ReactNode } from "react";
import * as RCheckbox from "@radix-ui/react-checkbox";
import { Check } from "lucide-react";
import { cn } from "../cn";

export function Checkbox({ checked, onCheckedChange, label, disabled, className, strikeWhenChecked }: { checked: boolean; onCheckedChange: (v: boolean) => void; label: ReactNode; disabled?: boolean; className?: string; strikeWhenChecked?: boolean }) {
  const id = useId();
  return (
    <div className={cn("flex min-h-[var(--touch-min)] min-w-0 items-center gap-3", className)}>
      <RCheckbox.Root
        id={id}
        checked={checked}
        onCheckedChange={(v) => onCheckedChange(v === true)}
        disabled={disabled}
        className="flex size-5 shrink-0 items-center justify-center rounded-[6px] border-2 border-muted bg-surface data-[state=checked]:border-primary data-[state=checked]:bg-primary disabled:opacity-50"
      >
        <RCheckbox.Indicator>
          <Check aria-hidden className="size-3.5 text-on-primary" strokeWidth={3} />
        </RCheckbox.Indicator>
      </RCheckbox.Root>
      <label htmlFor={id} className={cn("min-w-0 flex-1 cursor-pointer text-sm text-text", strikeWhenChecked && checked && "text-muted line-through")}>
        {label}
      </label>
    </div>
  );
}
