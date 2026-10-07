import Link from "next/link";
import { ROUTES } from "@/app-shell/nav-config";
import { Illustration } from "@/design/components/Illustration";
import { t } from "@/i18n/vi";
import styles from "../landing.module.css";

export function LandingBrand() {
  return <Link href={ROUTES.landing} className={styles.brand} aria-label={t("appName")}><Illustration name="logo-mark" height={42} /><span>{t("appName")}</span></Link>;
}
