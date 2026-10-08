import Link from "next/link";
import { ROUTES } from "@/app-shell/nav-config";
import { BrandLogo } from "@/design/components/BrandLogo";
import { t } from "@/i18n/vi";
import styles from "../landing.module.css";

export function LandingBrand() {
  return <Link href={ROUTES.landing} className={styles.brand} aria-label={t("appName")}><BrandLogo /></Link>;
}
