"use client";

import type { ReactNode } from "react";
import * as RTabs from "@radix-ui/react-tabs";
import { cn } from "../cn";

export interface TabItem {
  value: string;
  label: string;
  icon?: ReactNode;
  content?: ReactNode;
}

/** Pill tabs as in the mockups; the list scrolls sideways on phones instead of wrapping. */
export function Tabs({ items, value, defaultValue, onValueChange, label, className }: { items: TabItem[]; value?: string; defaultValue?: string; onValueChange?: (v: string) => void; label: string; className?: string }) {
  return (
    <RTabs.Root value={value} defaultValue={defaultValue ?? items[0]?.value} onValueChange={onValueChange} className={cn("flex min-w-0 flex-col gap-4", className)}>
      <RTabs.List aria-label={label} className="-mx-1 flex gap-1 overflow-x-auto px-1 pb-1 [scrollbar-width:none]">
        {items.map((it) => (
          <RTabs.Trigger
            key={it.value}
            value={it.value}
            className={cn(
              "inline-flex h-9 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-control px-3.5 text-sm font-medium text-body transition-colors",
              "hover:bg-primary-soft hover:text-primary data-[state=active]:bg-primary data-[state=active]:text-on-primary",
            )}
          >
            {it.icon}
            {it.label}
          </RTabs.Trigger>
        ))}
      </RTabs.List>
      {items.map((it) =>
        it.content !== undefined ? (
          <RTabs.Content key={it.value} value={it.value} className="min-w-0 focus-visible:outline-none">
            {it.content}
          </RTabs.Content>
        ) : null,
      )}
    </RTabs.Root>
  );
}
