import { test } from "node:test";
import assert from "node:assert/strict";
import { parseCsv, formatCsv } from "./csv.mjs";

test("CSV preserves Vietnamese, commas, quotes and multiline oracle text", () => {
  const headers = ["id", "expected"];
  const records = [{ id: "FAM-001", expected: 'Nhắc "Mẹ", đúng giờ\nsau reload' }];
  assert.deepEqual(parseCsv(formatCsv(headers, records)), { headers, records });
});
test("CSV rejects truncated rows, unclosed fields and duplicate headers", () => {
  for (const text of ['id,expected\na\n', 'id,expected\na,"unfinished', 'id,id\na,b\n', 'id,expected\na,b"c"d\n', 'id,expected\na,"b"text\n', 'id,\na,b\n']) assert.throws(() => parseCsv(text));
});
