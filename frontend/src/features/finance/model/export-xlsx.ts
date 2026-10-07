import type { FinanceGoal, FinanceSaving, FinanceTxn } from "@/core/model/finance";
import type { Member } from "@/core/model/member";
import { FINANCE_CATEGORY_LABELS, FINANCE_TXN_TYPE_LABELS } from "./categories";
import { monthSummary } from "./month-summary";
import { toMoney, toNumber } from "./money";

export interface FinanceExportData {
  txns: FinanceTxn[];
  savings: FinanceSaving[];
  goals: FinanceGoal[];
  members: Member[];
}

const MONEY_FORMAT = "#,##0";
const vnDate = (d: string) => `${d.slice(8, 10)}/${d.slice(5, 7)}/${d.slice(0, 4)}`;

/**
 * XLSX for one month (modules.md §7): "Giao dịch" lists the transactions, "Tổng hợp" the overview. Amounts are
 * numbers so the file can be summed in Excel; expenses are negative.
 */
export async function buildFinanceWorkbook(month: string, data: FinanceExportData): Promise<ArrayBuffer> {
  // exceljs is large; loaded only when the user actually exports.
  const { default: ExcelJS } = await import("exceljs");
  const wb = new ExcelJS.Workbook();
  wb.creator = "Lịch Gia Đình";

  const names = new Map(data.members.map((m) => [m.id, m.displayName]));
  const txns = data.txns
    .filter((t) => t.deletedAt === null && t.date.slice(0, 7) === month)
    .sort((a, b) => (a.date === b.date ? a.createdAt.localeCompare(b.createdAt) : a.date < b.date ? -1 : 1));

  const sheet = wb.addWorksheet("Giao dịch");
  sheet.columns = [
    { header: "Ngày", key: "date", width: 12 },
    { header: "Loại", key: "type", width: 14 },
    { header: "Danh mục", key: "category", width: 16 },
    { header: "Số tiền (VND)", key: "amount", width: 16, style: { numFmt: MONEY_FORMAT } },
    { header: "Thành viên", key: "member", width: 16 },
    { header: "Ghi chú", key: "note", width: 40 },
  ];
  for (const t of txns) {
    const amount = toNumber(toMoney(t.amount));
    sheet.addRow({
      date: vnDate(t.date),
      type: FINANCE_TXN_TYPE_LABELS[t.type],
      category: FINANCE_CATEGORY_LABELS[t.category],
      amount: t.type === "EXPENSE" ? -amount : amount,
      member: t.memberId ? (names.get(t.memberId) ?? "") : "",
      note: t.note ?? "",
    });
  }
  sheet.getRow(1).font = { bold: true };

  const s = monthSummary(data.txns, data.savings, data.goals, month);
  const summary = wb.addWorksheet("Tổng hợp");
  summary.columns = [
    { key: "label", width: 24 },
    { key: "amount", width: 18, style: { numFmt: MONEY_FORMAT } },
    { key: "percent", width: 10 },
  ];
  summary.addRow({ label: `Tháng ${month.slice(5, 7)}/${month.slice(0, 4)}` }).font = { bold: true };
  summary.addRow({ label: "Tổng thu", amount: toNumber(s.income) });
  summary.addRow({ label: "Tổng chi", amount: toNumber(s.expense) });
  summary.addRow({ label: "Tiết kiệm", amount: toNumber(s.saved) });
  summary.addRow({ label: "Còn lại", amount: toNumber(s.remaining) });
  summary.addRow({});
  summary.addRow({ label: "Chi theo danh mục", percent: "%" }).font = { bold: true };
  for (const c of s.byCategory) summary.addRow({ label: FINANCE_CATEGORY_LABELS[c.category], amount: toNumber(c.amount), percent: c.percent });

  return (await wb.xlsx.writeBuffer()) as ArrayBuffer;
}
