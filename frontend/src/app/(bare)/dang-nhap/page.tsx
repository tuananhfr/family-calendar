import Link from "next/link";
import { IdentityFrame } from "@/features/identity/components/IdentityFrame";
import { EmailForm } from "@/features/identity/components/EmailForm";
import { t } from "@/i18n/vi";
export default function LoginPage() {
  return <IdentityFrame title={t("sharing.login")}><EmailForm mode="login" /><Link href="/khoi-phuc/" className="text-sm text-primary underline">{t("sharing.recover")}</Link></IdentityFrame>;
}
