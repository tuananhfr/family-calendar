import Image from "next/image";
import { ArrowRight, Bell, CalendarDays, ListChecks } from "lucide-react";
import { withBase } from "@/core/config";
import { t } from "@/i18n/vi";
import styles from "../landing.module.css";

const features = [{ key: "calendar", Icon: CalendarDays }, { key: "tasks", Icon: ListChecks }, { key: "reminders", Icon: Bell }] as const;

export function CalendarSection() {
  return (
    <section id="tinh-nang" className={`${styles.section} ${styles.calendarSection}`} aria-labelledby="calendar-heading">
      <figure className={styles.calendarPreview}>
        <Image src={withBase("/landing/week-preview.webp")} alt={t("landing.calendar.previewAlt")} width={914} height={746} sizes="(max-width: 900px) 92vw, 55vw" />
        <figcaption>{t("landing.hero.sample")}</figcaption>
      </figure>
      <div className={styles.calendarCopy}>
        <p className={styles.eyebrow}>{t("landing.calendar.label")}</p>
        <h2 id="calendar-heading">{t("landing.calendar.title")}</h2>
        <p className={styles.body}>{t("landing.calendar.body")}</p>
        <ul className={styles.featureRows}>
          {features.map(({ key, Icon }) => (
            <li key={key}>
              <Icon aria-hidden size={34} strokeWidth={1.6} />
              <div>
                <h3>{t(`landing.calendar.${key}Title`)}</h3>
                <p>{t(`landing.calendar.${key}Body`)}</p>
              </div>
            </li>
          ))}
        </ul>
        <a href="#bat-dau" className={styles.textLink}>
          {t("landing.calendar.link")}<ArrowRight aria-hidden size={20} />
        </a>
      </div>
    </section>
  );
}
