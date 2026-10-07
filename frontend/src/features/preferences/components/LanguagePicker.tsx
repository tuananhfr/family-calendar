"use client";

import { useId } from "react";
import * as Menu from "@radix-ui/react-dropdown-menu";
import { Check, ChevronDown, Globe } from "lucide-react";
import { t } from "@/i18n/vi";
import { LANGUAGE_OPTIONS, type LanguageOptionCode } from "../languages";
import { useLanguagePreviewStore } from "../language-preview.store";
import styles from "../preferences.module.css";

export function LanguagePicker() {
  const noticeId = useId();
  const language = useLanguagePreviewStore((s) => s.language);
  const selectLanguage = useLanguagePreviewStore((s) => s.selectLanguage);
  const current = LANGUAGE_OPTIONS.find((option) => option.code === language)!;

  return (
    <Menu.Root>
      <Menu.Trigger className={styles.languageTrigger} aria-label={t("preferences.language.current", { name: current.label })}>
        <Globe aria-hidden size={19} />
        <span className={styles.languageName}>{current.label}</span>
        <span className={styles.languageCode} aria-hidden>{current.shortLabel}</span>
        <ChevronDown aria-hidden size={14} />
      </Menu.Trigger>
      <Menu.Portal>
        <Menu.Content className={`${styles.menu} ${styles.languageMenu}`} align="end" sideOffset={8} collisionPadding={12} aria-describedby={noticeId}>
          <Menu.Label className={styles.menuLabel}>{t("preferences.language.title")}</Menu.Label>
          <p className={styles.notice} id={noticeId}>{t("preferences.language.notice")}</p>
          <Menu.Separator className={styles.separator} />
          <Menu.RadioGroup value={language} onValueChange={(value) => selectLanguage(value as LanguageOptionCode)} aria-label={t("preferences.language.title")}>
            {LANGUAGE_OPTIONS.map((option) => (
              <Menu.RadioItem className={styles.item} key={option.code} value={option.code}>
                <span className={styles.indicator}><Menu.ItemIndicator><Check aria-hidden size={16} /></Menu.ItemIndicator></span>
                <span lang={option.tag} dir={option.dir}>{option.label}</span>
              </Menu.RadioItem>
            ))}
          </Menu.RadioGroup>
        </Menu.Content>
      </Menu.Portal>
    </Menu.Root>
  );
}
