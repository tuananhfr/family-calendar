"use client";

import * as Menu from "@radix-ui/react-dropdown-menu";
import { Check, Moon, Sun } from "lucide-react";
import { t } from "@/i18n/vi";
import { useAppStore, type ThemePreference } from "@/store/app.store";
import styles from "../preferences.module.css";

const THEMES = [{ value: "light", Icon: Sun }, { value: "dark", Icon: Moon }] as const;

export function ThemePicker() {
  const theme = useAppStore((s) => s.theme);
  const setTheme = useAppStore((s) => s.setTheme);
  const Icon = THEMES.find((option) => option.value === theme)?.Icon ?? Sun;
  const label = t("preferences.theme.current", { name: t(`preferences.theme.${theme}`) });

  return (
    <Menu.Root>
      <Menu.Trigger className={styles.themeTrigger} aria-label={label} title={label}><Icon aria-hidden size={20} /></Menu.Trigger>
      <Menu.Portal>
        <Menu.Content className={styles.menu} align="end" sideOffset={8} collisionPadding={12}>
          <Menu.Label className={styles.menuLabel}>{t("preferences.theme.title")}</Menu.Label>
          <Menu.RadioGroup value={theme} onValueChange={(value) => setTheme(value as ThemePreference)} aria-label={t("preferences.theme.title")}>
            {THEMES.map(({ value, Icon: ItemIcon }) => (
              <Menu.RadioItem className={styles.item} key={value} value={value}>
                <span className={styles.indicator}><Menu.ItemIndicator><Check aria-hidden size={16} /></Menu.ItemIndicator></span>
                <ItemIcon aria-hidden size={18} />
                {t(`preferences.theme.${value}`)}
              </Menu.RadioItem>
            ))}
          </Menu.RadioGroup>
        </Menu.Content>
      </Menu.Portal>
    </Menu.Root>
  );
}
