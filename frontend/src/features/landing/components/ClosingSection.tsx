import Image from "next/image";
import Link from "next/link";
import { ROUTES } from "@/app-shell/nav-config";
import { withBase } from "@/core/config";
import { t } from "@/i18n/vi";
import { LandingBrand } from "./LandingBrand";
import { StartLink } from "./StartLink";
import styles from "../landing.module.css";

const links = ["about", "privacy", "help", "contact"] as const;

export function ClosingSection() {
  return (
    <section className={styles.closing} aria-labelledby="closing-heading">
      <div className={styles.closingMain}>
        <Image src={withBase("/landing/family-dinner.webp")} alt={t("landing.closing.alt")} fill sizes="100vw" className={styles.closingBackdrop} />
        <div className={styles.closingContent}>
          <h2 id="closing-heading">{t("landing.closing.title")}<br />{t("landing.closing.secondLine")}</h2>
          <p>{t("landing.closing.body")}</p>
          <StartLink inverse />
          <p className={styles.returning}>
            {t("landing.closing.returning")} <Link href={ROUTES.today}>{t("landing.openApp")}</Link>
          </p>
        </div>
      </div>
      <footer className={styles.footer}>
        <div><LandingBrand /><p>{t("tagline")}</p></div>
        <nav aria-label={t("footer.about")}>
          {links.map((key) => <Link key={key} href={ROUTES[key]}>{t(`footer.${key}`)}</Link>)}
        </nav>
      </footer>
    </section>
  );
}
