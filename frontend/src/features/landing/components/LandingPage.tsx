import { LandingHeader } from "./LandingHeader";
import { HeroSection } from "./HeroSection";
import { CalendarSection } from "./CalendarSection";
import { FamilyFeatures } from "./FamilyFeatures";
import { GetStartedSection } from "./GetStartedSection";
import { DataSection } from "./DataSection";
import { ClosingSection } from "./ClosingSection";
import styles from "../landing.module.css";

export function LandingPage() {
  return (
    <div className={styles.landing}>
      <LandingHeader />
      <main id="landing-main" tabIndex={-1}>
        <HeroSection />
        <CalendarSection />
        <FamilyFeatures />
        <GetStartedSection />
        <DataSection />
        <ClosingSection />
      </main>
    </div>
  );
}
