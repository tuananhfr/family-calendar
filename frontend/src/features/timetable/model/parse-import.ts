import Papa from "papaparse";
import type { Member } from "@/core/model/member";
import { levenshtein, normalizeVi } from "@/core/search/normalize";

/** ISO weekday: 1 = Thứ 2 … 7 = Chủ nhật. */
export type ImportWeekday = 1 | 2 | 3 | 4 | 5 | 6 | 7;

export interface ImportRow {
  line: number;
  weekday: ImportWeekday;
  start: string;
  end: string;
  subject: string;
  /** Display name of the matched member (not the text typed in the file). */
  memberName: string;
  memberId: string;
  category: "STUDY" | "ACTIVITY";
}

export interface ImportError {
  /** 1-based line in the file; 0 = the whole file. */
  line: number;
  field: string;
  message: string;
}

export interface ImportResult {
  rows: ImportRow[];
  errors: ImportError[];
}

export interface ImportContext {
  members: Array<Pick<Member, "id" | "displayName">>;
}

export const MAX_IMPORT_ROWS = 500;
export const MAX_IMPORT_BYTES = 5 * 1024 * 1024;
const MAX_SUBJECT = 100;

const COLUMNS = [
  { key: "weekday", label: "Thứ", names: ["thu", "ngay", "thu trong tuan"] },
  { key: "start", label: "Bắt đầu", names: ["bat dau", "gio bat dau", "tu"] },
  { key: "end", label: "Kết thúc", names: ["ket thuc", "gio ket thuc", "den"] },
  { key: "subject", label: "Môn/Hoạt động", names: ["mon/hoat dong", "mon", "hoat dong", "mon hoc"] },
  { key: "member", label: "Thành viên", names: ["thanh vien", "ten", "hoc sinh"] },
  { key: "category", label: "Danh mục", names: ["danh muc", "loai"] },
] as const;
type ColumnKey = (typeof COLUMNS)[number]["key"];
const OPTIONAL: ReadonlySet<ColumnKey> = new Set(["category"]);

const fileError = (message: string): ImportResult => ({ rows: [], errors: [{ line: 0, field: "file", message }] });
const TOO_LARGE = "Tệp lớn hơn 5 MB";
const TOO_MANY = `Tối đa ${MAX_IMPORT_ROWS} dòng`;

const WEEKDAYS: Record<string, ImportWeekday> = {
  "thu 2": 1, "thu hai": 1, t2: 1, "2": 1,
  "thu 3": 2, "thu ba": 2, t3: 2, "3": 2,
  "thu 4": 3, "thu tu": 3, t4: 3, "4": 3,
  "thu 5": 4, "thu nam": 4, t5: 4, "5": 4,
  "thu 6": 5, "thu sau": 5, t6: 5, "6": 5,
  "thu 7": 6, "thu bay": 6, t7: 6, "7": 6,
  "chu nhat": 7, cn: 7,
};

const CATEGORIES: Record<string, ImportRow["category"]> = {
  "": "STUDY",
  "hoc tap": "STUDY",
  hoc: "STUDY",
  "ngoai khoa": "ACTIVITY",
  "hoat dong": "ACTIVITY",
};

function parseWeekday(raw: string): ImportWeekday | null {
  return WEEKDAYS[normalizeVi(raw)] ?? null;
}

function parseTime(raw: string): string | null {
  const m = /^(\d{1,2})[:hH](\d{2})$/.exec(raw.trim());
  if (!m) return null;
  const h = Number(m[1]);
  const min = Number(m[2]);
  if (h > 23 || min > 59) return null;
  return `${String(h).padStart(2, "0")}:${m[2]}`;
}

function matchMember(raw: string, ctx: ImportContext): { member?: Pick<Member, "id" | "displayName">; suggestion?: string } {
  const key = normalizeVi(raw);
  const member = ctx.members.find((m) => normalizeVi(m.displayName) === key);
  if (member) return { member };
  let best: { name: string; d: number } | undefined;
  for (const m of ctx.members) {
    const d = levenshtein(key, normalizeVi(m.displayName));
    if (!best || d < best.d) best = { name: m.displayName, d };
  }
  // Only suggest something plausibly the same name.
  return best && best.d <= Math.max(2, Math.floor(key.length / 3)) ? { suggestion: best.name } : {};
}

/** Shared by CSV and XLSX: `table[0]` is the header row, values are already plain text. */
function parseTable(table: string[][], ctx: ImportContext): ImportResult {
  const nonEmpty = (r: string[]) => r.some((c) => c.trim() !== "");
  const header = table[0] ?? [];
  const index = new Map<ColumnKey, number>();
  header.forEach((h, i) => {
    const name = normalizeVi(h);
    const col = COLUMNS.find((c) => (c.names as readonly string[]).includes(name));
    if (col && !index.has(col.key)) index.set(col.key, i);
  });
  const missing = COLUMNS.filter((c) => !index.has(c.key) && !OPTIONAL.has(c.key));
  if (missing.length > 0) return { rows: [], errors: [{ line: 1, field: "header", message: `Thiếu cột: ${missing.map((c) => c.label).join(", ")}` }] };

  const body = table.slice(1).map((cells, i) => ({ line: i + 2, cells })).filter((r) => nonEmpty(r.cells));
  if (body.length > MAX_IMPORT_ROWS) return fileError(TOO_MANY);

  const rows: ImportRow[] = [];
  const errors: ImportError[] = [];
  for (const { line, cells } of body) {
    const get = (k: ColumnKey) => (index.has(k) ? (cells[index.get(k)!] ?? "").trim() : "");
    const fail = (field: string, message: string) => errors.push({ line, field, message });

    const weekday = parseWeekday(get("weekday"));
    if (!weekday) { fail("weekday", `Thứ không hợp lệ: "${get("weekday")}"`); continue; }
    const start = parseTime(get("start"));
    if (!start) { fail("start", `Giờ không hợp lệ: "${get("start")}"`); continue; }
    const end = parseTime(get("end"));
    if (!end) { fail("end", `Giờ không hợp lệ: "${get("end")}"`); continue; }
    if (end <= start) { fail("end", "Giờ kết thúc phải sau giờ bắt đầu"); continue; }
    const subject = get("subject");
    if (!subject) { fail("subject", "Thiếu tên môn/hoạt động"); continue; }
    if (subject.length > MAX_SUBJECT) { fail("subject", `Tên môn/hoạt động tối đa ${MAX_SUBJECT} ký tự`); continue; }
    const { member, suggestion } = matchMember(get("member"), ctx);
    if (!member) {
      fail("member", `Không có thành viên "${get("member")}".${suggestion ? ` Có phải "${suggestion}"?` : ""}`);
      continue;
    }
    const category = CATEGORIES[normalizeVi(get("category"))];
    if (!category) { fail("category", `Danh mục không hợp lệ: "${get("category")}" (Học tập hoặc Ngoại khóa)`); continue; }
    rows.push({ line, weekday, start, end, subject, memberName: member.displayName, memberId: member.id, category });
  }
  return { rows, errors };
}

export function parseTimetableCsv(text: string, ctx: ImportContext): ImportResult {
  if (new TextEncoder().encode(text).length > MAX_IMPORT_BYTES) return fileError(TOO_LARGE);
  const parsed = Papa.parse<string[]>(text.replace(/^﻿/, ""), { skipEmptyLines: false });
  return parseTable(parsed.data.map((r) => r.map(String)), ctx);
}

/** Plain text of a cell; formulas give their cached result and are never evaluated, hyperlinks only their text. */
function cellText(value: unknown): string {
  if (value === null || value === undefined) return "";
  if (value instanceof Date) {
    // Excel time-of-day cells come back as a date on 1899-12-30 in UTC.
    return `${String(value.getUTCHours()).padStart(2, "0")}:${String(value.getUTCMinutes()).padStart(2, "0")}`;
  }
  if (typeof value === "number") {
    if (value > 0 && value < 1) {
      const minutes = Math.round(value * 24 * 60);
      return `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`;
    }
    return String(value);
  }
  if (typeof value === "object") {
    const v = value as { result?: unknown; formula?: unknown; sharedFormula?: unknown; richText?: Array<{ text: string }>; text?: unknown; error?: unknown };
    if ("formula" in v || "sharedFormula" in v) return cellText(v.result);
    if (Array.isArray(v.richText)) return v.richText.map((t) => t.text).join("");
    if ("text" in v) return cellText(v.text);
    return "";
  }
  return String(value);
}

export async function parseTimetableXlsx(buf: ArrayBuffer, ctx: ImportContext): Promise<ImportResult> {
  if (buf.byteLength > MAX_IMPORT_BYTES) return fileError(TOO_LARGE);
  // exceljs is large; loaded only when a file is imported.
  const { default: ExcelJS } = await import("exceljs");
  const wb = new ExcelJS.Workbook();
  try {
    await wb.xlsx.load(buf);
  } catch {
    return fileError("Không đọc được tệp Excel");
  }
  const ws = wb.worksheets[0];
  if (!ws) return fileError("Không đọc được tệp Excel");
  // Header + 500 data rows; stop reading early so a huge sheet can't stall the tab.
  if (ws.actualRowCount > MAX_IMPORT_ROWS + 1) return fileError(TOO_MANY);
  const table: string[][] = [];
  ws.eachRow({ includeEmpty: true }, (row, n) => {
    const cells: string[] = [];
    row.eachCell({ includeEmpty: true }, (cell, c) => {
      cells[c - 1] = cellText(cell.value);
    });
    table[n - 1] = Array.from(cells, (c) => c ?? "");
  });
  return parseTable(Array.from(table, (r) => r ?? []), ctx);
}
