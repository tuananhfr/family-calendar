"use client";

import { useId } from "react";
import * as RSwitch from "@radix-ui/react-switch";
import { cn } from "../cn";

export function Switch({ checked, onCheckedChange, label, description, disabled, hideLabel, className }: { checked: boolean; onCheckedChange: (v: boolean) => void; label: string; description?: string; disabled?: boolean; hideLabel?: boolean; className?: string }) {
  const id = useId();
  return (
    <div className={cn("flex min-h-[var(--touch-min)] items-center gap-3", className)}>
      {!hideLabel ? (
        <label htmlFor={id} className="min-w-0 flex-1 cursor-pointer">
          <span className="block truncate text-sm text-text">{label}</span>
          {description ? <span className="block truncate text-xs text-muted">{description}</span> : null}
        </label>
      ) : null}
      <RSwitch.Root
        id={id}
        checked={checked}
        onCheckedChange={onCheckedChange}
        disabled={disabled}
        aria-label={hideLabel ? label : undefined}
        className="relative h-7 w-12 shrink-0 rounded-chip bg-disabled-text transition-colors data-[state=checked]:bg-primary disabled:opacity-50"
      >
        <RSwitch.Thumb className="block size-5 translate-x-1 rounded-full bg-surface shadow-sm transition-transform data-[state=checked]:translate-x-6" />
      </RSwitch.Root>
    </div>
  );
}
