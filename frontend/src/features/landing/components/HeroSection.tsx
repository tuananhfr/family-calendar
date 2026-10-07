import Image from "next/image";
import { ArrowRight } from "lucide-react";
import { withBase } from "@/core/config";
import { t } from "@/i18n/vi";
import { StartLink } from "./StartLink";
import styles from "../landing.module.css";

export function HeroSection() {
  return (
    <section className={styles.hero} aria-labelledby="landing-title">
      <Image src={withBase("/landing/hero-family.webp")} alt="" fill priority sizes="100vw" className={styles.heroBackdrop} />
      <div className={styles.heroContent}>
        <h1 id="landing-title">{t("landing.hero.title")}</h1>
        <p>{t("landing.hero.body")}</p>
        <div className={styles.heroActions}>
          <StartLink />
          <a href="#tinh-nang" className={styles.textLink}>
            {t("landing.explore")}<ArrowRight aria-hidden size={20} />
          </a>
        </div>
      </div>
      <figure className={styles.heroPreview}>
        <Image src={withBase("/landing/today-preview.webp")} alt={t("landing.hero.previewAlt")} width={1288} height={680} priority sizes="(max-width: 767px) 94vw, 66vw" />
        <figcaption>{t("landing.hero.sample")}</figcaption>
      </figure>
    </section>
  );
}
