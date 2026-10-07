import Image from "next/image";
import Link from "next/link";
import { ArrowRight, Bell, FileDown, Laptop } from "lucide-react";
import { ROUTES } from "@/app-shell/nav-config";
import { withBase } from "@/core/config";
import { t } from "@/i18n/vi";
import styles from "../landing.module.css";

const features = [{ key: "local", Icon: Laptop }, { key: "backup", Icon: FileDown }, { key: "reminders", Icon: Bell }] as const;

export function DataSection() {
  return (
    <section id="du-lieu" className={styles.dataSection} aria-labelledby="data-heading">
      <div className={styles.dataArt}>
        <Image src={withBase("/landing/data-family.webp")} alt={t("landing.data.alt")} fill sizes="100vw" className={styles.dataBackdrop} />
      </div>
      <div className={`${styles.section} ${styles.dataInner}`}>
        <div className={styles.dataCopy}>
          <p className={styles.eyebrow}>{t("landing.data.label")}</p>
          <h2 id="data-heading">{t("landing.data.title")}</h2>
          <p className={styles.body}>{t("landing.data.body")}</p>
          <ul className={`${styles.featureRows} ${styles.dataRows}`}>
            {features.map(({ key, Icon }) => (
              <li key={key}>
                <Icon aria-hidden size={34} strokeWidth={1.6} />
                <div>
                  <h3>{t(`landing.data.${key}Title`)}</h3>
                  <p>{t(`landing.data.${key}Body`)}</p>
                </div>
              </li>
            ))}
          </ul>
          <Link href={ROUTES.privacy} className={styles.textLink}>
            {t("landing.data.link")}<ArrowRight aria-hidden size={20} />
          </Link>
        </div>
      </div>
    </section>
  );
}
