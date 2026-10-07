"use client";

import { useState } from "react";
import { BellOff, BellRing, Smartphone } from "lucide-react";
import { cn } from "@/design/cn";
import { Button, toast } from "@/design/components";
import { t } from "@/i18n/vi";
import { useNotificationPermission } from "../hooks/useNotificationPermission";

/**
 * Real browser permission state with one button that only appears while the browser would still ask. Never asks on
 * load, never re-asks after a refusal (reminders.md: no repeated prompt).
 */
export function PermissionPrompt({ className }: { className?: string }) {
  const { caps, request } = useNotificationPermission();
  const [asking, setAsking] = useState(false);
  if (!caps) return null;
  const state = caps.notification;
  const on = state === "granted";

  const ask = async () => {
    setAsking(true);
    try {
      await request();
    } catch {
      toast(t("notifications.permission.failed"), "error");
    } finally {
      setAsking(false);
    }
  };

  return (
    <section
      aria-label={t("notifications.permission.label")}
      data-testid="notification-permission"
      data-state={state}
      className={cn("flex flex-col gap-3 rounded-card border p-4 sm:flex-row sm:items-center", on ? "border-success/30 bg-success-soft" : "border-border bg-surface", className)}
    >
      <span aria-hidden className={cn("flex size-10 shrink-0 items-center justify-center rounded-full", on ? "bg-surface text-success" : "bg-primary-soft text-primary")}>
        {on ? <BellRing className="size-5" /> : <BellOff className="size-5" />}
      </span>
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <p className="text-sm font-semibold text-text">{t("notifications.permission.label")}</p>
        <p className="text-sm text-body">{t(`notifications.permission.${state}`)}</p>
        {caps.iosNeedsHomeScreen && !on ? (
          <p className="flex items-center gap-1.5 text-sm text-muted">
            <Smartphone aria-hidden className="size-4 shrink-0" />
            {t("notifications.permission.iosHomeScreen")}
          </p>
        ) : null}
      </div>
      {state === "default" ? (
        <Button className="shrink-0 self-start sm:self-center" icon={<BellRing className="size-4" />} onClick={() => void ask()} loading={asking}>
          {t("notifications.permission.enable")}
        </Button>
      ) : null}
    </section>
  );
}
