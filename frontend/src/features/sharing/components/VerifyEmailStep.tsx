"use client";
import { useState } from "react";
import { usePathname } from "next/navigation";
import { EmailForm } from "@/features/identity/components/EmailForm";
import { useLinkedAccount } from "@/features/identity/hooks/useLinkedAccount";
import { rememberAfterVerify } from "@/features/identity/model/after-verify";
import { t } from "@/i18n/vi";

export function VerifyEmailStep() {
  const pathname = usePathname();
  const { identity, account } = useLinkedAccount();
  // Sending the link creates a session mid-submit; only a session that existed on load may hide the form while loading.
  const [hadSession, setHadSession] = useState<boolean>();
  if (hadSession === undefined && identity !== undefined) setHadSession(!!identity);
  if (account.data?.linked) return <p className="break-all text-sm text-primary">{t("sharing.emailVerified")}: {account.data.email}</p>;
  if (hadSession === undefined || (hadSession && account.isPending)) return <p className="text-sm text-muted" role="status">{t("sharing.setupChecking")}</p>;
  return <>
    <p className="text-sm text-body">{t("sharing.setupEmailHint")}</p>
    <EmailForm mode="link" onSent={() => rememberAfterVerify(pathname + location.search)} />
  </>;
}
