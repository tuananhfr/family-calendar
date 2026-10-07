import { describe, expect, it } from "vitest";
import type { FinanceGoal } from "@/core/model/finance";
import { baseFields } from "@/core/test-support/records";
import { goalProgress } from "./goal-progress";

const goal = (contributions: FinanceGoal["contributions"], targetAmount = 30_000_000): FinanceGoal =>
  ({ ...baseFields(), name: "Du lịch hè", targetAmount, contributions }) as FinanceGoal;

describe("goalProgress", () => {
  it("sums contributions and gives a whole-number percent", () => {
    expect(goalProgress(goal([{ date: "2026-09-01", amount: 6_000_000 }, { date: "2026-10-01", amount: 4_000_000 }]))).toEqual({ saved: BigInt(10_000_000), percent: 33 });
  });

  it("never shows 100% before the target is reached, and caps above it", () => {
    expect(goalProgress(goal([{ date: "2026-09-01", amount: 29_999_999 }])).percent).toBe(99);
    expect(goalProgress(goal([{ date: "2026-09-01", amount: 30_000_000 }])).percent).toBe(100);
    expect(goalProgress(goal([{ date: "2026-09-01", amount: 45_000_000 }]))).toEqual({ saved: BigInt(45_000_000), percent: 100 });
    expect(goalProgress(goal([])).percent).toBe(0);
  });
});
