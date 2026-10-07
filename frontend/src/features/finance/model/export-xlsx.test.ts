import ExcelJS from "exceljs";
import { describe, expect, it } from "vitest";
import type { FinanceTxn } from "@/core/model/finance";
import type { Member } from "@/core/model/member";
import { baseFields } from "@/core/test-support/records";
import { makeMember } from "@/core/test-support/items";
import { buildFinanceWorkbook } from "./export-xlsx";

const bo: Member = makeMember("Bố");
const txns = [
  { ...baseFields(), type: "INCOME", amount: 25_000_000, category: "SALARY", date: "2026-10-05", memberId: bo.id, note: "Lương tháng 10" },
  { ...baseFields(), type: "EXPENSE", amount: 2_000_000, category: "EDUCATION", date: "2026-10-10", note: "Học phí bé An" },
  { ...baseFields(), type: "EXPENSE", amount: 1_000, category: "FOOD", date: "2026-09-30" },
] as FinanceTxn[];

async function load(buffer: ArrayBuffer) {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(buffer);
  return wb;
}

describe("buildFinanceWorkbook", () => {
  it("has the two sheets 'Giao dịch' and 'Tổng hợp' with numeric amounts", async () => {
    const wb = await load(await buildFinanceWorkbook("2026-10", { txns, savings: [], goals: [], members: [bo] }));
    expect(wb.worksheets.map((w) => w.name)).toEqual(["Giao dịch", "Tổng hợp"]);

    const sheet = wb.getWorksheet("Giao dịch")!;
    expect(sheet.getRow(1).values).toEqual([undefined, "Ngày", "Loại", "Danh mục", "Số tiền (VND)", "Thành viên", "Ghi chú"]);
    expect(sheet.rowCount).toBe(3);
    const first = sheet.getRow(2);
    expect(first.getCell(1).value).toBe("05/10/2026");
    expect(first.getCell(2).value).toBe("Thu");
    expect(first.getCell(3).value).toBe("Lương");
    expect(first.getCell(4).value).toBe(25_000_000);
    expect(typeof first.getCell(4).value).toBe("number");
    expect(first.getCell(5).value).toBe("Bố");
    // Expenses are negative so a SUM over the column gives the net.
    expect(sheet.getRow(3).getCell(4).value).toBe(-2_000_000);

    const summary = wb.getWorksheet("Tổng hợp")!;
    const byLabel = new Map<string, unknown>();
    summary.eachRow((row) => byLabel.set(String(row.getCell(1).value), row.getCell(2).value));
    expect(byLabel.get("Tổng thu")).toBe(25_000_000);
    expect(byLabel.get("Tổng chi")).toBe(2_000_000);
    expect(byLabel.get("Tiết kiệm")).toBe(0);
    expect(byLabel.get("Còn lại")).toBe(23_000_000);
    expect(byLabel.get("Học tập")).toBe(2_000_000);
  });
});
