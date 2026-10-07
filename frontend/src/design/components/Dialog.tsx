"use client";

import type { ReactNode } from "react";
import * as RDialog from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import { t } from "@/i18n/vi";
import { cn } from "../cn";
import { Illustration, type IllustrationName } from "./Illustration";

export interface DialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  icon?: ReactNode;
  illustration?: IllustrationName;
  size?: "sm" | "md" | "lg";
  footer?: ReactNode;
  children?: ReactNode;
}

const WIDTHS = { sm: "max-w-md", md: "max-w-2xl", lg: "max-w-4xl" } as const;

/** Centered modal on desktop; becomes a full-height sheet under 640px so long forms stay usable. */
export function Dialog({ open, onOpenChange, title, description, icon, illustration, size = "md", footer, children }: DialogProps) {
  return (
    <RDialog.Root open={open} onOpenChange={onOpenChange}>
      <RDialog.Portal>
        <RDialog.Overlay className="fixed inset-0 z-40 bg-[var(--color-overlay)] backdrop-blur-[2px]" />
        <RDialog.Content
          className={cn(
            "fixed inset-x-0 bottom-0 z-50 flex max-h-[100dvh] w-full flex-col rounded-t-card bg-surface shadow-pop",
            "sm:inset-auto sm:left-1/2 sm:top-1/2 sm:max-h-[90dvh] sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-card",
            WIDTHS[size],
          )}
        >
          <div className="flex items-start gap-3 px-5 pb-2 pt-5 sm:px-7 sm:pt-7">
            {icon ? (
              <span aria-hidden className="flex size-12 shrink-0 items-center justify-center rounded-card bg-primary-soft text-primary [&_svg]:size-6">
                {icon}
              </span>
            ) : null}
            <div className="min-w-0 flex-1">
              <RDialog.Title className="text-lg font-bold text-text sm:text-xl">{title}</RDialog.Title>
              {description ? <RDialog.Description className="mt-1 text-sm text-muted">{description}</RDialog.Description> : <RDialog.Description className="sr-only">{title}</RDialog.Description>}
            </div>
            {illustration ? <Illustration name={illustration} height={96} className="-my-2 hidden md:block" /> : null}
            <RDialog.Close aria-label={t("common.close")} className="-mr-2 -mt-1 inline-flex size-[var(--touch-min)] shrink-0 items-center justify-center rounded-control text-muted hover:bg-primary-soft hover:text-primary">
              <X aria-hidden className="size-5" />
            </RDialog.Close>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto px-5 py-3 sm:px-7">{children}</div>
          {footer ? <div className="flex flex-wrap items-center justify-end gap-2 border-t border-border px-5 py-4 sm:px-7">{footer}</div> : null}
        </RDialog.Content>
      </RDialog.Portal>
    </RDialog.Root>
  );
}
