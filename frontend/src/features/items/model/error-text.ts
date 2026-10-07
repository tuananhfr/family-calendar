import { t } from "@/i18n/vi";

/** Field error code → Vietnamese text; unknown codes (new schema rules) fall back to a generic message. */
export function itemErrorText(code: string | undefined): string | undefined {
  if (!code) return undefined;
  try {
    return t(`items.errors.${code}`);
  } catch {
    return t("items.errors.UNKNOWN");
  }
}
