// Writes the XLSX fixtures of src/features/timetable/fixtures (CSV fixtures are hand-written).
// Run: node scripts/make-timetable-fixtures.mjs
import ExcelJS from "exceljs";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const dir = new URL("../src/features/timetable/fixtures/", import.meta.url);

function csvRows() {
  return readFileSync(new URL("tkb.csv", dir), "utf8")
    .trim()
    .split(/\r?\n/)
    .map((line) => line.split(","));
}

async function write(name, fill) {
  const wb = new ExcelJS.Workbook();
  // Fixed dates keep the files byte-stable between runs.
  wb.created = wb.modified = new Date("2026-10-01T00:00:00Z");
  fill(wb.addWorksheet("TKB"));
  await wb.xlsx.writeFile(fileURLToPath(new URL(name, dir)));
}

await write("tkb.xlsx", (ws) => {
  for (const row of csvRows()) ws.addRow(row);
});

await write("tkb-formula.xlsx", (ws) => {
  const [header, first] = csvRows();
  ws.addRow(header);
  ws.addRow(first);
  // Thứ is a formula whose cached result is 3 (= "Thứ 3"); subject is a formula with a text result.
  const row = ws.addRow([null, "08:00", "08:45", null, first[4], first[5]]);
  row.getCell(1).value = { formula: "1+2", result: 3 };
  row.getCell(4).value = { formula: 'CONCATENATE("Toán"," nâng cao")', result: "Toán nâng cao" };
  // A hyperlink cell: only its text may be imported.
  const link = ws.addRow(["Thứ 4", "09:00", "09:45", null, first[4], first[5]]);
  link.getCell(4).value = { text: "Tiếng Anh", hyperlink: "https://example.com/phishing" };
});

console.log("wrote tkb.xlsx, tkb-formula.xlsx");
