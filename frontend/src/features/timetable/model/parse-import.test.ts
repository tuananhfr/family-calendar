import { readFileSync } from "node:fs";
import ExcelJS from "exceljs";
import { describe, expect, it } from "vitest";
import { makeMember } from "@/core/test-support/items";
import { MAX_IMPORT_BYTES, MAX_IMPORT_ROWS, parseTimetableCsv, parseTimetableXlsx } from "./parse-import";

const bin = makeMember("Bin");
const na = makeMember("Na");
const members = [bin, na];

const fixture = (name: string) => readFileSync(new URL(`../fixtures/${name}`, import.meta.url));
const text = (name: string) => fixture(name).toString("utf8");
const buffer = (name: string) => {
  const b = fixture(name);
  return b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength) as ArrayBuffer;
};

const HEADER = "Thứ,Bắt đầu,Kết thúc,Môn/Hoạt động,Thành viên,Danh mục";

describe("parseTimetableCsv", () => {
  it("tkb.csv: 10 valid rows, no errors", () => {
    const r = parseTimetableCsv(text("tkb.csv"), { members });
    expect(r.errors).toEqual([]);
    expect(r.rows).toHaveLength(10);
    expect(r.rows[0]).toEqual({ line: 2, weekday: 1, start: "07:00", end: "07:45", subject: "Toán", memberName: "Bin", memberId: bin.id, category: "STUDY" });
    expect(r.rows.find((x) => x.subject === "Bơi")).toMatchObject({ weekday: 3, category: "ACTIVITY" });
    // Chủ nhật is 7 (ISO weekday); 'T2' and a bare '3' are accepted; empty category = Học tập.
    expect(r.rows.map((x) => x.weekday)).toEqual([1, 1, 2, 3, 4, 5, 6, 7, 1, 2]);
    expect(r.rows[9].category).toBe("STUDY");
  });

  it("tkb-bad.csv: one error per bad line, with its line number", () => {
    const r = parseTimetableCsv(text("tkb-bad.csv"), { members });
    expect(r.rows.map((x) => x.line)).toEqual([8]);
    const byLine = Object.fromEntries(r.errors.map((e) => [e.line, e]));
    expect(byLine[2]).toMatchObject({ field: "weekday", message: 'Thứ không hợp lệ: "Thứ 8"' });
    expect(byLine[3]).toMatchObject({ field: "start", message: 'Giờ không hợp lệ: "25:00"' });
    expect(byLine[4]).toMatchObject({ field: "end", message: "Giờ kết thúc phải sau giờ bắt đầu" });
    expect(byLine[5]).toMatchObject({ field: "subject" });
    expect(byLine[6]).toMatchObject({ field: "member", message: 'Không có thành viên "Binn". Có phải "Bin"?' });
    expect(byLine[7]).toMatchObject({ field: "category" });
  });

  it("matches member names without case or diacritics", () => {
    const an = makeMember("Bé An");
    const r = parseTimetableCsv(`${HEADER}\nThứ 2,7:00,7:45,Toán,be an,học tập`, { members: [an] });
    expect(r.rows[0]).toMatchObject({ memberId: an.id, memberName: "Bé An", start: "07:00", end: "07:45" });
  });

  it("more than 500 rows → one file error and no rows", () => {
    const lines = Array.from({ length: MAX_IMPORT_ROWS + 1 }, () => "Thứ 2,07:00,07:45,Toán,Bin,Học tập");
    const r = parseTimetableCsv([HEADER, ...lines].join("\n"), { members });
    expect(MAX_IMPORT_ROWS).toBe(500);
    expect(r).toEqual({ rows: [], errors: [{ line: 0, field: "file", message: "Tối đa 500 dòng" }] });
    expect(parseTimetableCsv([HEADER, ...lines.slice(1)].join("\n"), { members }).rows).toHaveLength(500);
  });

  it("a file over 5 MB is refused before parsing", () => {
    expect(MAX_IMPORT_BYTES).toBe(5 * 1024 * 1024);
    const big = `${HEADER}\n${"x".repeat(6 * 1024 * 1024)}`;
    expect(parseTimetableCsv(big, { members })).toEqual({ rows: [], errors: [{ line: 0, field: "file", message: "Tệp lớn hơn 5 MB" }] });
  });

  it("a missing column is reported once", () => {
    const r = parseTimetableCsv("Thứ,Bắt đầu,Môn\nThứ 2,07:00,Toán", { members });
    expect(r.rows).toEqual([]);
    expect(r.errors).toEqual([{ line: 1, field: "header", message: "Thiếu cột: Kết thúc, Thành viên" }]);
  });

  it("keeps formula-looking text as plain text (never evaluated)", () => {
    const r = parseTimetableCsv(`${HEADER}\nThứ 2,07:00,07:45,=1+1,Bin,Học tập`, { members });
    expect(r.rows[0].subject).toBe("=1+1");
  });
});

describe("parseTimetableXlsx", () => {
  it("tkb.xlsx gives the same rows as tkb.csv", async () => {
    const r = await parseTimetableXlsx(buffer("tkb.xlsx"), { members });
    expect(r.errors).toEqual([]);
    expect(r.rows).toEqual(parseTimetableCsv(text("tkb.csv"), { members }).rows);
  });

  it("formula cells give their cached value and hyperlinks only their text", async () => {
    const r = await parseTimetableXlsx(buffer("tkb-formula.xlsx"), { members });
    expect(r.errors).toEqual([]);
    expect(r.rows.map((x) => [x.weekday, x.subject])).toEqual([
      [1, "Toán"],
      [2, "Toán nâng cao"],
      [3, "Tiếng Anh"],
    ]);
    for (const row of r.rows) for (const v of Object.values(row)) expect(String(v)).not.toMatch(/^=|CONCATENATE|https?:/);
  });

  it("reads time cells stored as Excel times", async () => {
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet("TKB");
    ws.addRow(HEADER.split(","));
    ws.addRow(["Thứ 2", 7 / 24, new Date(Date.UTC(1899, 11, 30, 7, 45)), "Toán", "Bin", "Học tập"]);
    const r = await parseTimetableXlsx((await wb.xlsx.writeBuffer()) as ArrayBuffer, { members });
    expect(r.rows[0]).toMatchObject({ start: "07:00", end: "07:45" });
  });

  it("size and row limits apply to XLSX too", async () => {
    expect(await parseTimetableXlsx(new ArrayBuffer(MAX_IMPORT_BYTES + 1), { members })).toEqual({ rows: [], errors: [{ line: 0, field: "file", message: "Tệp lớn hơn 5 MB" }] });
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet("TKB");
    ws.addRow(HEADER.split(","));
    for (let i = 0; i <= MAX_IMPORT_ROWS; i++) ws.addRow(["Thứ 2", "07:00", "07:45", "Toán", "Bin", "Học tập"]);
    const r = await parseTimetableXlsx((await wb.xlsx.writeBuffer()) as ArrayBuffer, { members });
    expect(r.errors).toEqual([{ line: 0, field: "file", message: "Tối đa 500 dòng" }]);
  });

  it("a file that is not a workbook is a file error", async () => {
    const r = await parseTimetableXlsx(new TextEncoder().encode("not a zip").buffer as ArrayBuffer, { members });
    expect(r.errors).toEqual([{ line: 0, field: "file", message: "Không đọc được tệp Excel" }]);
  });
});
