import Link from "next/link";
import { ROUTES } from "@/app-shell/nav-config";
import { t } from "@/i18n/vi";
import { AppearanceControls } from "@/features/preferences/components/AppearanceControls";
import { LandingBrand } from "./LandingBrand";
import styles from "../landing.module.css";

export function LandingHeader() {
  return (
    <>
      <a href="#landing-main" className={styles.skip}>{t("landing.skip")}</a>
      <header className={styles.header}>
        <div className={styles.headerInner}>
          <LandingBrand />
          <nav className={styles.navigation} aria-label={t("landing.navLabel")}>
            <a href="#tinh-nang">{t("landing.featuresLink")}</a>
            <a href="#bat-dau">{t("landing.stepsLink")}</a>
            <a href="#du-lieu">{t("landing.dataLink")}</a>
          </nav>
          <div className={styles.headerActions}>
            <AppearanceControls className={styles.preferences} />
            <Link href={ROUTES.today} className={styles.openApp}>{t("landing.openApp")}</Link>
          </div>
        </div>
      </header>
    </>
  );
}
