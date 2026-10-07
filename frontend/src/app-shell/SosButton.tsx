"use client";

import { useState } from "react";
import { Siren } from "lucide-react";
import { t } from "@/i18n/vi";
import { cn } from "@/design/cn";
import { Button, Dialog } from "@/design/components";

/** Placeholder until Task 49 wires hold-to-send; it must never imply an alert was sent. */
export function SosButton({ className }: { className?: string }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={t("sos.button")}
        className={cn(
          "inline-flex h-9 shrink-0 items-center gap-1 rounded-chip border-2 border-danger px-3 text-sm font-bold text-danger transition-colors hover:bg-danger hover:text-on-primary",
          className,
        )}
      >
        <Siren aria-hidden className="size-4" />
        {t("sos.button")}
      </button>
      <Dialog open={open} onOpenChange={setOpen} size="sm" title={t("shell.sosSoonTitle")} icon={<Siren />} footer={<Button onClick={() => setOpen(false)}>{t("common.close")}</Button>}>
        <p className="text-sm text-body">{t("shell.sosSoonBody")}</p>
      </Dialog>
    </>
  );
}
