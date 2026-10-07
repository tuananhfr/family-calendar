export const LANGUAGE_OPTIONS = [
  { code: "vi", label: "Tiếng Việt", shortLabel: "VI", tag: "vi", dir: "ltr" },
  { code: "en", label: "English", shortLabel: "EN", tag: "en", dir: "ltr" },
  { code: "fr", label: "Français", shortLabel: "FR", tag: "fr", dir: "ltr" },
  { code: "ja", label: "日本語", shortLabel: "JA", tag: "ja", dir: "ltr" },
  { code: "ko", label: "한국어", shortLabel: "KO", tag: "ko", dir: "ltr" },
  { code: "zh-hans", label: "简体中文", shortLabel: "简", tag: "zh-Hans", dir: "ltr" },
  { code: "zh-hant", label: "繁體中文", shortLabel: "繁", tag: "zh-Hant", dir: "ltr" },
  { code: "th", label: "ไทย", shortLabel: "TH", tag: "th", dir: "ltr" },
  { code: "id", label: "Bahasa Indonesia", shortLabel: "ID", tag: "id", dir: "ltr" },
  { code: "ms", label: "Bahasa Melayu", shortLabel: "MS", tag: "ms", dir: "ltr" },
  { code: "fil", label: "Filipino", shortLabel: "FIL", tag: "fil", dir: "ltr" },
  { code: "km", label: "ខ្មែរ", shortLabel: "KM", tag: "km", dir: "ltr" },
  { code: "lo", label: "ລາວ", shortLabel: "LO", tag: "lo", dir: "ltr" },
  { code: "my", label: "မြန်မာ", shortLabel: "MY", tag: "my", dir: "ltr" },
  { code: "ar", label: "العربية", shortLabel: "AR", tag: "ar", dir: "rtl" },
] as const;

export type LanguageOptionCode = (typeof LANGUAGE_OPTIONS)[number]["code"];
