import { readFileSync, writeFileSync } from "node:fs";
const raw = JSON.parse(readFileSync(process.argv[2], "utf8"));
const results = [];
function visit(value) {
  if (!value || typeof value !== "object") return;
  if (value.name === "local-performance" && value.body) results.push(JSON.parse(Buffer.from(value.body, "base64").toString("utf8")));
  for (const nested of Object.values(value)) if (nested && typeof nested === "object") {
    if (Array.isArray(nested)) nested.forEach(visit); else visit(nested);
  }
}
visit(raw);
if (process.argv[3]) writeFileSync(process.argv[3], JSON.stringify(results, null, 2) + "\n", "utf8");
console.log(JSON.stringify(results.map(({ samplesMs, ...summary }) => { void samplesMs; return summary; }), null, 2));
