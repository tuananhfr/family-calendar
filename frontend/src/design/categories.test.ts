import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { CATEGORIES, CATEGORY_META, PRIORITIES, PRIORITY_META } from "./categories";

const tokens = fs.readFileSync(path.resolve(__dirname, "tokens.css"), "utf8");

describe("CATEGORY_META", () => {
  it("covers all 11 categories", () => {
    expect(CATEGORIES).toHaveLength(11);
    expect(Object.keys(CATEGORY_META).sort()).toEqual([...CATEGORIES].sort());
  });

  it.each(CATEGORIES)("%s has a Vietnamese label, an icon and existing color tokens", (c) => {
    const meta = CATEGORY_META[c];
    expect(meta.label.trim()).not.toBe("");
    expect(meta.icon).toBeTruthy();
    for (const v of [meta.bgVar, meta.dotVar]) {
      expect(v).toMatch(/^--cat-[a-z]+-(bg|dot)$/);
      expect(tokens).toContain(`${v}:`);
    }
  });
});

describe("PRIORITY_META", () => {
  it.each(PRIORITIES)("%s has label and icon", (p) => {
    expect(PRIORITY_META[p].label.trim()).not.toBe("");
    expect(PRIORITY_META[p].icon).toBeTruthy();
  });
});
