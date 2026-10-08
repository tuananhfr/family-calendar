import Image from "next/image";
import { withBase } from "@/core/config";
import { cn } from "../cn";
import { t } from "@/i18n/vi";

export function BrandLogo({ compact = false, className }: { compact?: boolean; className?: string }) {
  const name = t("appName");
  const separator = name.indexOf(" ");

  return (
    <span className={cn("inline-flex shrink-0 items-center gap-2.5", className)}>
      <span aria-hidden className={cn("block shrink-0", compact ? "size-11" : "size-14")}>
        <Image
          src={withBase("/illustrations/family-logo-02-mark.webp")}
          width={512}
          height={512}
          alt=""
          priority
          className="size-full select-none object-contain"
        />
      </span>
      {!compact ? (
        <span className="text-[1.125rem] font-bold leading-[1.2] tracking-tight">
          <span className="block text-text">{name.slice(0, separator)}</span>
          <span className="block whitespace-nowrap text-danger">{name.slice(separator + 1)}</span>
        </span>
      ) : null}
    </span>
  );
}
