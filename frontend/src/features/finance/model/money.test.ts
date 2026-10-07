import { describe, expect, it } from "vitest";
import { MAX_MONEY } from "@/core/model/base";
import { formatVnd, parseVnd, percentChange, sumMoney, toMoney, toNumber } from "./money";

describe("parseVnd", () => {
  it("reads dotted thousands and plain digits", () => {
    expect(parseVnd("18.500.000")).toBe(BigInt(18500000));
    expect(parseVnd("18500000")).toBe(BigInt(18500000));
    expect(parseVnd(" 2.000.000đ ")).toBe(BigInt(2000000));
    expect(parseVnd("2.000.000 ₫")).toBe(BigInt(2000000));
    expect(parseVnd("0")).toBe(BigInt(0));
  });

  it("does no magic parsing", () => {
    for (const s of ["18,5tr", "18,500,000", "18.5", "1.2345", "-1000", "", "  ", "abc", "1e6", "1.000.00", ".000"]) expect(parseVnd(s)).toBeNull();
  });

  it("rejects amounts above the 15-digit server limit", () => {
    expect(parseVnd(String(MAX_MONEY))).toBe(BigInt(MAX_MONEY));
    expect(parseVnd("1000000000000000")).toBeNull();
  });
});

describe("formatVnd", () => {
  it("uses dots and a trailing đ", () => {
    expect(formatVnd(BigInt(18500000))).toBe("18.500.000đ");
    expect(formatVnd(BigInt(0))).toBe("0đ");
    expect(formatVnd(BigInt(999))).toBe("999đ");
    expect(formatVnd(BigInt(-2000000))).toBe("-2.000.000đ");
  });
});

describe("integer money", () => {
  it("adds without floating point drift", () => {
    expect(sumMoney([toMoney(100000), toMoney(200000)])).toBe(BigInt(300000));
    const big = sumMoney(Array.from({ length: 1000 }, () => toMoney(1_000_000_000)));
    expect(formatVnd(big)).toBe("1.000.000.000.000đ");
    expect(toNumber(big)).toBe(1_000_000_000_000);
  });

  it("toMoney refuses non-integers", () => {
    expect(() => toMoney(0.1 + 0.2)).toThrow(RangeError);
  });

  it("percentChange is null when the previous month is 0", () => {
    expect(percentChange(BigInt(110), BigInt(100))).toBe(10);
    expect(percentChange(BigInt(90), BigInt(100))).toBe(-10);
    expect(percentChange(BigInt(5), BigInt(0))).toBeNull();
    expect(percentChange(BigInt(1), BigInt(3))).toBe(-66.7);
  });
});
