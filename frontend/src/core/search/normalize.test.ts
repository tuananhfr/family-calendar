import { describe, expect, it } from "vitest";
import { levenshtein, normalizeVi } from "./normalize";

describe("normalizeVi", () => {
  it("drops case, diacritics and đ", () => {
    expect(normalizeVi("Đưa bé đi học")).toBe("dua be di hoc");
    expect(normalizeVi("  KHÁM   Răng ")).toBe("kham rang");
    expect(normalizeVi("Thứ Hai")).toBe("thu hai");
  });

  it("handles precomposed and decomposed input alike", () => {
    expect(normalizeVi("Tiếng Việt".normalize("NFC"))).toBe(normalizeVi("Tiếng Việt".normalize("NFD")));
  });
});

describe("levenshtein", () => {
  it("counts edits", () => {
    expect(levenshtein("bin", "binn")).toBe(1);
    expect(levenshtein("na", "nam")).toBe(1);
    expect(levenshtein("", "abc")).toBe(3);
    expect(levenshtein("abc", "abc")).toBe(0);
  });
});
