import Link from "next/link";
import { Siren } from "lucide-react";
import { t } from "@/i18n/vi";
import { cn } from "@/design/cn";

export function SosButton({ className }: { className?: string }) {
  return (
      <Link
        href="/sos/"
        aria-label={t("emergency.open")}
        className={cn(
          "inline-flex h-9 shrink-0 items-center gap-1 rounded-chip border-2 border-danger px-3 text-sm font-bold text-danger transition-colors hover:bg-danger hover:text-on-primary",
          className,
        )}
      >
        <Siren aria-hidden className="size-4" />
        {t("sos.button")}
      </Link>
  );
}
