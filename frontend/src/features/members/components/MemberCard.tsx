import Link from "next/link";
import { Plus, Sparkles } from "lucide-react";
import type { Member } from "@/core/model/member";
import type { LocalDate } from "@/core/time/local-date";
import { buttonClass, Card, Truncate } from "@/design/components";
import { cn } from "@/design/cn";
import { t } from "@/i18n/vi";
import { memberSubtitle } from "../model/relationship";
import { MemberAvatar } from "./MemberAvatar";

export function memberEditHref(id: string): string {
  return `/thanh-vien/them/?id=${encodeURIComponent(id)}`;
}

export function MemberCard({ member, today }: { member: Member; today: LocalDate }) {
  return (
    <Card padded={false} className="flex flex-col items-center gap-3 p-3 text-center sm:p-4 md:p-5" interactive>
      <MemberAvatar name={member.displayName} avatar={member.avatar} relationship={member.relationship} size="xl" />
      <div className="w-full min-w-0">
        <h2 className="text-base font-bold text-text">
          <Truncate text={member.displayName} />
        </h2>
        <p className="mt-0.5 text-sm text-muted">
          <Truncate text={memberSubtitle(member, today)} />
        </p>
      </div>
      {member.interests.length ? (
        <ul className="flex w-full flex-col gap-1 text-left text-sm text-body">
          {member.interests.slice(0, 3).map((i) => (
            <li key={i} className="flex min-w-0 items-center gap-2">
              <Sparkles aria-hidden className="size-4 shrink-0 text-primary" />
              <Truncate text={i} />
            </li>
          ))}
        </ul>
      ) : null}
      <Link
        href={memberEditHref(member.id)}
        className={cn(buttonClass("secondary", "sm", true), "mt-auto")}
        aria-label={`${t("members.edit")} ${member.displayName}`}
      >
        {t("members.edit")}
      </Link>
    </Card>
  );
}

export function AddMemberCard() {
  return (
    <Link
      href="/thanh-vien/them/"
      className="flex min-h-56 flex-col items-center justify-center gap-2 rounded-card border-2 border-dashed border-border-strong bg-surface p-5 text-center transition-colors hover:border-primary hover:bg-primary-soft/40"
    >
      <Plus aria-hidden className="size-10 text-primary" />
      <span className="text-base font-bold text-text">{t("members.add")}</span>
      <span className="text-sm text-muted">{t("members.addCardBody")}</span>
    </Link>
  );
}
