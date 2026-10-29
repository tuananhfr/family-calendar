import type { Metadata } from "next";
import { t } from "@/i18n/vi";
import { SearchScreen } from "@/features/search/components/SearchScreen";

export const metadata: Metadata = { title: t("search.title") };

export default function SearchPage() {
  return <SearchScreen />;
}
