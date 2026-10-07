// Fails (exit 1) when a declared text/background token pair misses WCAG AA, for both themes.
import fs from "node:fs";
import path from "node:path";

const css = fs.readFileSync(path.resolve(import.meta.dirname, "../src/design/tokens.css"), "utf8");

function block(selector) {
  const start = css.indexOf(selector + " {");
  if (start < 0) throw new Error(`Missing block ${selector}`);
  return css.slice(start, css.indexOf("}", start));
}
function vars(text) {
  const out = {};
  for (const m of text.matchAll(/--([\w-]+):\s*(#[0-9a-fA-F]{6})/g)) out[m[1]] = m[2];
  return out;
}
const light = vars(block(":root"));
const dark = { ...light, ...vars(block(':root[data-theme="dark"]')) };

function lum(hex) {
  const c = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
}
function ratio(a, b) {
  const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p);
  return (x + 0.05) / (y + 0.05);
}

// [foreground, background, minimum]
const pairs = [
  ["color-text", "color-bg", 4.5],
  ["color-text", "color-surface", 4.5],
  ["color-text-body", "color-surface", 4.5],
  ["color-text-muted", "color-surface", 4.5],
  ["color-text-muted", "color-bg", 4.5],
  ["color-on-primary", "color-primary", 4.5],
  ["color-primary", "color-surface", 4.5],
  ["color-primary", "color-primary-soft", 4.5],
  ["color-accent-script", "color-surface", 3],
  ["color-success", "color-success-soft", 4.5],
  ["color-warning", "color-warning-soft", 4.5],
  ["color-danger", "color-danger-soft", 4.5],
  ["color-danger", "color-surface", 4.5],
  ["color-focus", "color-surface", 3],
  ["color-text", "cat-study-bg", 4.5],
  ["color-text", "cat-health-bg", 4.5],
  ["color-text", "cat-special-bg", 4.5],
  ...["study", "housework", "family", "health", "finance", "shopping", "document", "activity", "sport", "special", "other"].flatMap((c) => [
    [`cat-${c}-dot`, `cat-${c}-bg`, 3],
    ["color-text", `cat-${c}-bg`, 4.5],
  ]),
];

let failed = 0;
for (const [theme, v] of [["light", light], ["dark", dark]]) {
  for (const [fg, bg, min] of pairs) {
    const r = ratio(v[fg], v[bg]);
    const ok = r >= min;
    if (!ok) failed++;
    console.log(`${ok ? "ok  " : "FAIL"} ${theme.padEnd(5)} ${fg} on ${bg}: ${r.toFixed(2)} (min ${min})`);
  }
}
process.exit(failed ? 1 : 0);
