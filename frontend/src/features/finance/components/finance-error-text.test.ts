import { describe, expect, it } from "vitest";
import { financeErrorText } from "./FinanceFormDialog";

describe("financeErrorText", () => {
  it("maps known codes and falls back for unknown ones instead of throwing", () => {
    expect(financeErrorText("BUDGET_DUPLICATE")).not.toMatch(/^finance\./);
    expect(financeErrorText("SOMETHING_NEW")).toBe(financeErrorText("UNKNOWN"));
  });
});
