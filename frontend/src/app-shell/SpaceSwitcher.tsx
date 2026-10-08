"use client";

import Link from "next/link";
import * as Menu from "@radix-ui/react-dropdown-menu";
import { Check, ChevronDown, Plus, UsersRound } from "lucide-react";
import { useActiveSpace } from "@/features/members/hooks/useActiveSpace";
import { t } from "@/i18n/vi";
import { cn } from "@/design/cn";
import { DataModeBadge } from "./DataModeBadge";
import { ROUTES } from "./nav-config";
import { useShellStore } from "./shell-store";

/** Profile-style switcher from the mockup ("Nhà mình ▾"); the badge sits outside the trigger to avoid nested buttons. */
export function SpaceSwitcher({ compact }: { compact?: boolean }) {
  const { space, spaces, setActive } = useActiveSpace();
  const name = useShellStore((s) => s.spaceName) ?? t("shell.familySpace");
  return (
    <div className="flex min-w-0 items-center gap-2">
      <span aria-hidden className={cn("flex shrink-0 items-center justify-center rounded-full bg-primary-soft text-primary", compact ? "size-8 max-[399px]:hidden" : "size-10")}>
        <UsersRound className={compact ? "size-4" : "size-5"} />
      </span>
      <div className={cn("flex min-w-0 flex-col items-start", compact ? "max-w-[7.5rem]" : "max-w-[10rem]")}>
        <Menu.Root>
          <Menu.Trigger aria-label={`${t("shell.switchSpace")}: ${name}`} className="inline-flex max-w-full items-center gap-1 rounded-control text-sm font-semibold text-text hover:text-primary">
            <span className="truncate">{name}</span>
            <ChevronDown aria-hidden className="size-4 shrink-0" />
          </Menu.Trigger>
          <Menu.Portal>
            <Menu.Content align="end" sideOffset={8} className="z-50 min-w-56 rounded-control border border-border bg-surface p-1 shadow-pop">
              <Menu.Label className="px-2 py-1.5 text-xs font-semibold text-muted">{t("shell.switchSpace")}</Menu.Label>
              {spaces.map((candidate) => <Menu.Item key={candidate.id} onSelect={() => setActive(candidate.id)} className="flex min-h-10 cursor-default items-center gap-2 rounded-[8px] px-2 text-sm text-text outline-none data-[highlighted]:bg-primary-soft">
                <Check aria-hidden className={cn("size-4 text-primary", candidate.id !== space?.id && "invisible")} />
                <span className="truncate">{candidate.name}</span>
              </Menu.Item>)}
              <Menu.Item asChild><Link href="/cai-dat/?tab=account" className="flex min-h-10 items-center rounded-control px-2 text-sm text-text outline-none data-[highlighted]:bg-primary-soft">{t("sharing.account")}</Link></Menu.Item>
              <Menu.Separator className="my-1 h-px bg-border" />
              <Menu.Item asChild>
                <Link href={ROUTES.groups} className="flex min-h-10 items-center gap-2 rounded-[8px] px-2 text-sm text-primary outline-none data-[highlighted]:bg-primary-soft">
                  <Plus aria-hidden className="size-4" />
                  {t("shell.createGroup")}
                </Link>
              </Menu.Item>
            </Menu.Content>
          </Menu.Portal>
        </Menu.Root>
        <DataModeBadge />
      </div>
    </div>
  );
}
