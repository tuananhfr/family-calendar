import { STATIC_PAGES } from "@/i18n/static-pages";
import { t } from "@/i18n/vi";

export const PUBLIC_PAGES = {
  home: { path: "/", title: t("appName"), description: t("landing.description") },
  about: { path: "/gioi-thieu/", ...STATIC_PAGES.about },
  help: { path: "/tro-giup/", ...STATIC_PAGES.help, intro: "Hướng dẫn sử dụng Lịch Gia Đình: chia sẻ lịch, sao lưu dữ liệu, khôi phục khi đổi thiết bị và chế độ người cao tuổi." },
  terms: { path: "/dieu-khoan/", ...STATIC_PAGES.terms },
  privacy: { path: "/quyen-rieng-tu/", ...STATIC_PAGES.privacy },
  contact: { path: "/lien-he/", ...STATIC_PAGES.contact },
} as const;

export type PublicPageKey = keyof typeof PUBLIC_PAGES;
