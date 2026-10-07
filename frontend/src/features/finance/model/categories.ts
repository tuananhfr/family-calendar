import type { FinanceCategory, FinanceTxnType } from "@/core/model/finance";

// Pure-logic labels (exports, notifications); screens use the i18n dictionary.
export const FINANCE_CATEGORY_LABELS: Record<FinanceCategory, string> = {
  FOOD: "Ăn uống",
  EDUCATION: "Học tập",
  LIVING: "Sinh hoạt",
  HEALTH: "Sức khỏe",
  ENTERTAINMENT: "Giải trí",
  TRANSPORT: "Di chuyển",
  HOUSING: "Nhà cửa",
  BILLS: "Hóa đơn",
  SHOPPING: "Mua sắm",
  OTHER: "Khác",
  SALARY: "Lương",
  BONUS: "Thưởng",
  BUSINESS: "Kinh doanh",
  TRANSFER: "Chuyển khoản",
};

export const FINANCE_TXN_TYPE_LABELS: Record<FinanceTxnType, string> = {
  INCOME: "Thu",
  EXPENSE: "Chi",
  TRANSFER: "Chuyển khoản",
};
