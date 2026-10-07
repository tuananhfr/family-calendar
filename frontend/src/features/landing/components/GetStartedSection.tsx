import { CalendarPlus, House, UsersRound } from "lucide-react";
import { Illustration } from "@/design/components/Illustration";
import { t } from "@/i18n/vi";
import { StartLink } from "./StartLink";
import styles from "../landing.module.css";

const steps = [{ key: "family", Icon: House }, { key: "members", Icon: UsersRound }, { key: "event", Icon: CalendarPlus }] as const;

export function GetStartedSection() {
  return (
    <section id="bat-dau" className={`${styles.section} ${styles.getStarted}`} aria-labelledby="steps-heading">
      <div className={styles.sectionHeading}><h2 id="steps-heading">{t("landing.steps.title")}</h2><p className={styles.body}>{t("landing.steps.body")}</p></div>
      <ol className={styles.steps}>{steps.map(({ key, Icon }, index) => <li key={key}>
        <span className={styles.stepNumber} aria-hidden>{index + 1}</span>
        <div className={styles.stepVisual} aria-hidden>{key === "members" ? <div className={styles.stepAvatars}>{(["avatar-father", "avatar-mother", "avatar-boy", "avatar-grandmother"] as const).map((name) => <Illustration key={name} name={name} height={64} />)}</div> : <Icon size={68} strokeWidth={1.3} />}</div>
        <h3>{t(`landing.steps.${key}Title`)}</h3><p>{t(`landing.steps.${key}Body`)}</p>
      </li>)}</ol>
      <StartLink /><p className={styles.startNote}>{t("landing.steps.note")}</p>
    </section>
  );
}
