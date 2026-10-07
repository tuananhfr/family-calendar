import type { ReactNode } from "react";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { t } from "@/i18n/vi";
import { cn } from "../cn";
import { Card } from "./Card";

export interface SectionCardProps {
  title: string;
  seeAllHref?: string;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
}

export function SectionCard({ title, seeAllHref, actions, children, className }: SectionCardProps) {
  return (
    <Card className={cn("flex flex-col gap-3", className)}>
      <div className="flex min-w-0 items-center gap-2">
        <h2 className="min-w-0 flex-1 truncate text-base font-bold">{title}</h2>
        {actions}
        {seeAllHref ? (
          <Link href={seeAllHref} className="inline-flex shrink-0 items-center gap-1 rounded-control px-1 text-xs font-semibold text-primary hover:underline">
            {t("common.seeAll")}
            <ArrowRight aria-hidden className="size-3.5" />
          </Link>
        ) : null}
      </div>
      {children}
    </Card>
  );
}
