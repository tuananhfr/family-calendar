import Image from "next/image";
import { withBase } from "@/core/config";
import { t } from "@/i18n/vi";
import styles from "../landing.module.css";

const features = ["care", "finance", "storage", "special"] as const;

export function FamilyFeatures() {
  return (
    <section className={styles.section} aria-labelledby="family-features-heading">
      <div className={styles.sectionHeading}>
        <h2 id="family-features-heading">{t("landing.features.title")}</h2>
        <p className={styles.body}>{t("landing.features.body")}</p>
      </div>
      <div className={styles.familyGrid}>
        {features.map((key, index) => (
          <article className={styles.familyFeature} key={key}>
            <div className={styles.featurePhoto} role="img" aria-label={t(`landing.features.${key}.alt`)}>
              <Image
                src={withBase("/landing/family-features.webp")}
                alt="" width={2206} height={713} className={styles.photoStrip}
                style={{ left: `${-100 * index}%` }}
                sizes="(max-width: 520px) 400vw, (max-width: 1100px) 200vw, 100vw"
              />
            </div>
            <h3>{t(`landing.features.${key}.title`)}</h3>
            <p>{t(`landing.features.${key}.body`)}</p>
          </article>
        ))}
      </div>
    </section>
  );
}
