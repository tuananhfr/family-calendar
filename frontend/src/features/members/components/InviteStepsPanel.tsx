import Link from "next/link";
import { Share2 } from "lucide-react";
import { buttonClass, Card } from "@/design/components";
import { t } from "@/i18n/vi";

const STEP_COUNT = 4;

export function InviteStepsPanel() {
  return (
    <Card>
      <h2 className="text-sm font-bold text-text">{t("members.invite.stepsTitle")}</h2>
      <ol className="mt-3 flex flex-col gap-2.5">
        {Array.from({ length: STEP_COUNT }, (_, i) => (
          <li key={i} className="flex items-center gap-2.5 text-sm text-body">
            <span aria-hidden className="flex size-6 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-bold text-on-primary">
              {i + 1}
            </span>
            {t(`members.invite.steps.${i}`)}
          </li>
        ))}
      </ol>
    </Card>
  );
}

/** Invite tabs before sharing exists: explain honestly instead of showing a link that can't work (LOCAL_ONLY). */
export function InviteNeedsSharing() {
  return (
    <Card className="flex flex-col items-start gap-3">
      <span aria-hidden className="flex size-11 items-center justify-center rounded-card bg-primary-soft text-primary">
        <Share2 className="size-5" />
      </span>
      <h2 className="text-base font-bold text-text">{t("members.invite.needsSharingTitle")}</h2>
      <p className="max-w-prose text-sm text-body">{t("members.invite.needsSharingBody")}</p>
      <Link href="/cai-dat/?tab=data" className={buttonClass("primary", "md")}>
        {t("members.invite.openSettings")}
      </Link>
    </Card>
  );
}
