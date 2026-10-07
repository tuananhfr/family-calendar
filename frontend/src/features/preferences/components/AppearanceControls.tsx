"use client";

import { cn } from "@/design/cn";
import { LanguagePicker } from "./LanguagePicker";
import { ThemePicker } from "./ThemePicker";
import styles from "../preferences.module.css";

export function AppearanceControls({ compact = false, className }: { compact?: boolean; className?: string }) {
  return (
    <div className={cn(styles.controls, compact && styles.compact, className)}>
      <LanguagePicker />
      <ThemePicker />
    </div>
  );
}
