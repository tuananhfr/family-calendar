import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { ROUTES } from "@/app-shell/nav-config";
import { t } from "@/i18n/vi";
import styles from "../landing.module.css";

export function StartLink({ inverse = false }: { inverse?: boolean }) {
  return (
    <Link href={ROUTES.onboarding} className={`${styles.startLink} ${inverse ? styles.startLinkInverse : ""}`}>
      {t("landing.start")}
      <ArrowRight aria-hidden size={20} />
    </Link>
  );
}
