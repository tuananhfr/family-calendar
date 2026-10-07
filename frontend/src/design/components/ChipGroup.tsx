"use client";

import { cn } from "../cn";
import { Chip } from "./Chip";

export interface ChipOption<V extends string> {
  value: V;
  label: string;
}

/** Single-select filter row; scrolls horizontally on phones instead of wrapping into many lines. */
export function ChipGroup<V extends string>({ options, value, onChange, label, className }: { options: ChipOption<V>[]; value: V; onChange: (v: V) => void; label: string; className?: string }) {
  return (
    <div role="group" aria-label={label} className={cn("-mx-1 flex gap-2 overflow-x-auto px-1 pb-1 [scrollbar-width:none]", className)}>
      {options.map((o) => (
        <Chip key={o.value} selected={o.value === value} onClick={() => onChange(o.value)}>
          {o.label}
        </Chip>
      ))}
    </div>
  );
}
