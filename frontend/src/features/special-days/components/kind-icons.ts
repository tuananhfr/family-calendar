import { Cake, Flag, Flower2, Heart, Star, type LucideIcon } from "lucide-react";
import type { SpecialDayPreset } from "@/core/model/common";

// Giỗ gets a flower, not a cake or a party icon: it is a day of remembrance.
export const SPECIAL_KIND_ICON: Record<SpecialDayPreset, LucideIcon> = {
  BIRTHDAY: Cake,
  ANNIVERSARY: Heart,
  DEATH_ANNIVERSARY: Flower2,
  HOLIDAY: Flag,
  SPECIAL_DAY: Star,
};

export const SPECIAL_KIND_ORDER: SpecialDayPreset[] = ["BIRTHDAY", "ANNIVERSARY", "DEATH_ANNIVERSARY", "HOLIDAY", "SPECIAL_DAY"];
