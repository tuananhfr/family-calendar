import { MAX_MONEY } from "@/core/model/base";

// Money is integer VND. Records store it as a JS number (≤ 15 digits, exact in a double); sums and display go
// through bigint so totals never pick up floating-point drift.
export type Money = bigint;

const ZERO = BigInt(0);
const MAX = BigInt(MAX_MONEY);

export function toMoney(n: number): Money {
  if (!Number.isSafeInteger(n)) throw new RangeError(`Money must be an integer: ${n}`);
  return BigInt(n);
}

/** Exact for every value the server accepts (DECIMAL(15,0) < 2^53). */
export function toNumber(v: Money): number {
  return Number(v);
}

export function sumMoney(values: Iterable<Money>): Money {
  let total = ZERO;
  for (const v of values) total += v;
  return total;
}

const PLAIN = /^\d+$/;
const DOTTED = /^\d{1,3}(\.\d{3})+$/;

/**
 * '18.500.000', '18500000', '2.000.000đ' → amount; anything else (decimals, '18,5tr', negatives) → null.
 * Guessing what '18,5' means is how amounts end up off by 1000×.
 */
export function parseVnd(input: string): Money | null {
  const s = input.trim().replace(/\s*(đ|₫|VND|vnd)$/, "");
  if (!PLAIN.test(s) && !DOTTED.test(s)) return null;
  const v = BigInt(s.replace(/\./g, ""));
  return v > MAX ? null : v;
}

/** '18.500.000đ'; negative amounts keep their sign ('-2.000.000đ'). */
export function formatVnd(v: Money): string {
  const negative = v < ZERO;
  const digits = (negative ? -v : v).toString();
  return `${negative ? "-" : ""}${digits.replace(/\B(?=(\d{3})+(?!\d))/g, ".")}đ`;
}

/** Change vs `prev` in percent, one decimal; null when `prev` is 0 (no meaningful ratio). */
export function percentChange(current: Money, prev: Money): number | null {
  if (prev === ZERO) return null;
  const p = Number(prev);
  return Math.round(((Number(current) - p) / Math.abs(p)) * 1000) / 10;
}

/** Share of `part` in `total` in percent, one decimal; 0 when total is 0. */
export function percentOf(part: Money, total: Money): number {
  if (total === ZERO) return 0;
  return Math.round((Number(part) / Number(total)) * 1000) / 10;
}
