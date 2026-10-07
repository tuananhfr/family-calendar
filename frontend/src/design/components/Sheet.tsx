"use client";

import type { ReactNode } from "react";
import * as RDialog from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import { t } from "@/i18n/vi";
import { cn } from "../cn";

export interface SheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  side?: "bottom" | "left" | "right";
  children?: ReactNode;
}

const SIDES = {
  bottom: "inset-x-0 bottom-0 max-h-[85dvh] rounded-t-card",
  left: "inset-y-0 left-0 w-[min(20rem,85vw)]",
  right: "inset-y-0 right-0 w-[min(26rem,92vw)]",
} as const;

export function Sheet({ open, onOpenChange, title, side = "bottom", children }: SheetProps) {
  return (
    <RDialog.Root open={open} onOpenChange={onOpenChange}>
      <RDialog.Portal>
        <RDialog.Overlay className="fixed inset-0 z-40 bg-[var(--color-overlay)]" />
        <RDialog.Content className={cn("fixed z-50 flex flex-col bg-surface shadow-pop", SIDES[side])}>
          {side === "bottom" ? <span aria-hidden className="mx-auto mt-2 h-1 w-10 rounded-chip bg-border-strong" /> : null}
          <div className="flex items-center gap-2 px-4 pb-2 pt-3">
            <RDialog.Title className="min-w-0 flex-1 truncate text-lg font-bold text-text">{title}</RDialog.Title>
            <RDialog.Description className="sr-only">{title}</RDialog.Description>
            <RDialog.Close aria-label={t("common.close")} className="inline-flex size-[var(--touch-min)] items-center justify-center rounded-control text-muted hover:bg-primary-soft hover:text-primary">
              <X aria-hidden className="size-5" />
            </RDialog.Close>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-[max(1rem,env(safe-area-inset-bottom))]">{children}</div>
        </RDialog.Content>
      </RDialog.Portal>
    </RDialog.Root>
  );
}
