"use client";

import * as Popover from "@radix-ui/react-popover";
import { Cloud, CloudAlert, CloudOff, HardDrive, RefreshCw, ShieldCheck, TriangleAlert } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { t } from "@/i18n/vi";
import { cn } from "@/design/cn";
import { TONE_SOFT, type Tone } from "@/design/tones";
import { useShellStore, type DataMode } from "./shell-store";

const META: Record<DataMode, { icon: LucideIcon; tone: Tone }> = {
  local: { icon: HardDrive, tone: "neutral" },
  shared: { icon: Cloud, tone: "primary" },
  synced: { icon: Cloud, tone: "success" },
  pending: { icon: RefreshCw, tone: "warning" },
  conflict: { icon: TriangleAlert, tone: "danger" },
  offline: { icon: CloudOff, tone: "neutral" },
  blocked: { icon: CloudAlert, tone: "danger" },
  authRequired: { icon: CloudAlert, tone: "warning" },
  accountBacked: { icon: ShieldCheck, tone: "success" },
};

/** Honest data-mode indicator (v3.0 §4): never shows "synced" unless the sync layer says so. */
export function DataModeBadge({ className }: { className?: string }) {
  const mode = useShellStore((s) => s.dataMode);
  const pending = useShellStore((s) => s.pendingOps);
  const { icon: Icon, tone } = META[mode];
  const label = t(`dataMode.${mode}`, { n: pending });
  return (
    <Popover.Root>
      <Popover.Trigger
        aria-label={`${t("shell.dataModeDetail")}: ${label}`}
        className={cn("inline-flex max-w-full items-center gap-1 rounded-chip px-2 py-0.5 text-[11px] font-semibold", TONE_SOFT[tone], className)}
      >
        <Icon aria-hidden className="size-3 shrink-0" />
        <span className="truncate">{label}</span>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content sideOffset={6} align="end" className="z-50 w-72 rounded-control border border-border bg-surface p-3 text-sm text-body shadow-pop">
          <p className="font-semibold text-text">{label}</p>
          {mode === "local" ? <p className="mt-1 text-muted">{t("shell.localModeBody")}</p> : null}
          <Popover.Arrow className="fill-surface" />
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
