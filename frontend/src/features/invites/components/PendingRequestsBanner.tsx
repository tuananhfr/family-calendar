"use client";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { UserRoundPlus } from "lucide-react";
import { buttonClass } from "@/design/components";
import { t } from "@/i18n/vi";
import { getJoinRequests } from "../model/api";

/** Surfaces waiting join requests outside the invite tab, where approvers otherwise never look. */
export function PendingRequestsBanner({ spaceId }: { spaceId: string }) {
  const requests = useQuery({ queryKey: ["join-requests", spaceId], queryFn: () => getJoinRequests(spaceId), refetchInterval: 30_000 });
  const count = requests.data?.requests.filter((r) => r.status === "PENDING").length ?? 0;
  if (!count) return null;
  return (
    <div role="status" className="flex flex-wrap items-center gap-3 rounded-card border border-primary/30 bg-primary-soft px-4 py-3">
      <span aria-hidden className="flex size-9 shrink-0 items-center justify-center rounded-full bg-surface text-primary">
        <UserRoundPlus className="size-5" />
      </span>
      <p className="min-w-0 flex-1 text-sm font-semibold text-text">{t("sharing.pendingBanner", { n: count })}</p>
      <Link href="/thanh-vien/them/?tab=link" className={buttonClass("primary", "sm")}>
        {t("sharing.reviewRequests")}
      </Link>
    </div>
  );
}
