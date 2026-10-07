import type { LucideIcon } from "lucide-react";
import {
  ArrowDown,
  ArrowUp,
  Cake,
  Dumbbell,
  FileText,
  GraduationCap,
  HeartPulse,
  House,
  Minus,
  Palette,
  Shapes,
  ShoppingCart,
  Users,
  Wallet,
} from "lucide-react";
import { t } from "@/i18n/vi";
import { CATEGORIES, type Category, type Priority } from "@/core/model/common";

export { CATEGORIES, PRIORITIES, type Category, type Priority } from "@/core/model/common";

export interface CategoryMeta {
  label: string;
  icon: LucideIcon;
  bgVar: string;
  dotVar: string;
}

const ICONS: Record<Category, LucideIcon> = {
  STUDY: GraduationCap,
  HOUSEWORK: House,
  FAMILY: Users,
  HEALTH: HeartPulse,
  FINANCE: Wallet,
  SHOPPING: ShoppingCart,
  DOCUMENT: FileText,
  ACTIVITY: Palette,
  SPORT: Dumbbell,
  SPECIAL: Cake,
  // Not Ellipsis: next to a row's ⋮ menu it reads as a second actions button.
  OTHER: Shapes,
};

export const CATEGORY_META = Object.fromEntries(
  CATEGORIES.map((c) => {
    const key = c.toLowerCase();
    return [c, { label: t(`category.${c}`), icon: ICONS[c], bgVar: `--cat-${key}-bg`, dotVar: `--cat-${key}-dot` }];
  }),
) as Record<Category, CategoryMeta>;

export interface PriorityMeta {
  label: string;
  icon: LucideIcon;
  tone: "danger" | "warning" | "success";
}

export const PRIORITY_META: Record<Priority, PriorityMeta> = {
  HIGH: { label: t("priority.HIGH"), icon: ArrowUp, tone: "danger" },
  MEDIUM: { label: t("priority.MEDIUM"), icon: Minus, tone: "warning" },
  LOW: { label: t("priority.LOW"), icon: ArrowDown, tone: "success" },
};
