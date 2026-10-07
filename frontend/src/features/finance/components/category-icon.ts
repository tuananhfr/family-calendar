import type { LucideIcon } from "lucide-react";
import { ArrowLeftRight, Banknote, Briefcase, Building2, Car, Gamepad2, Gift, GraduationCap, HeartPulse, House, Receipt, ShoppingCart, Utensils, Wallet } from "lucide-react";
import type { FinanceCategory } from "@/core/model/finance";

export const CATEGORY_ICON: Record<FinanceCategory, LucideIcon> = {
  FOOD: Utensils,
  EDUCATION: GraduationCap,
  LIVING: House,
  HEALTH: HeartPulse,
  ENTERTAINMENT: Gamepad2,
  TRANSPORT: Car,
  HOUSING: Building2,
  BILLS: Receipt,
  SHOPPING: ShoppingCart,
  OTHER: Wallet,
  SALARY: Banknote,
  BONUS: Gift,
  BUSINESS: Briefcase,
  TRANSFER: ArrowLeftRight,
};
