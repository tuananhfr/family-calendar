import { beforeEach, describe, expect, it } from "vitest";
import { db } from "@/core/db/db";
import type { Item } from "@/core/model/item";
import type { ReminderRule } from "@/core/model/reminder-rule";
import { listNotifications } from "@/core/notifications/local-center";
import { listActive } from "@/core/repo/read";
import { createLocalSpace } from "@/core/repo/write";
import { addGoalContribution, addLoanPayment, FinanceFormError, recordPaymentExpense, saveBudget, saveLoan, saveSaving, saveTxn, saveGoal } from "./finance-writes";

const MEMBER = "11111111-1111-4111-8111-111111111111";
let spaceId: string;

beforeEach(async () => {
  await db.delete();
  await db.open();
  spaceId = await createLocalSpace({ kind: "FAMILY", name: "Nhà" });
});

const expense = (amount: number, category: "FOOD" | "EDUCATION" = "FOOD", date = "2026-10-05") => saveTxn(spaceId, { type: "EXPENSE", amount, category, date });

describe("finance writes", () => {
  it("saves a valid expense and rejects a category of the wrong type with a field code", async () => {
    const txn = await expense(2_000_000, "EDUCATION");
    expect(txn).toMatchObject({ amount: 2_000_000, category: "EDUCATION", spaceId });
    await expect(saveTxn(spaceId, { type: "INCOME", amount: 1, category: "FOOD", date: "2026-10-05" })).rejects.toMatchObject({ fields: { category: "CATEGORY_NOT_IN_TYPE" } });
    await expect(saveTxn(spaceId, { type: "EXPENSE", amount: 0, category: "FOOD", date: "2026-10-05" })).rejects.toBeInstanceOf(FinanceFormError);
  });

  it("alerts once when a budget reaches 80% and once more when it goes over", async () => {
    await saveBudget(spaceId, { month: "2026-10", category: "FOOD", limitAmount: 5_000_000 });
    await expense(3_000_000);
    expect(await listNotifications({ spaceId })).toHaveLength(0);
    await expense(1_100_000);
    let notes = await listNotifications({ spaceId });
    expect(notes).toHaveLength(1);
    expect(notes[0]).toMatchObject({ type: "BUDGET_ALERT", titleSafe: "Ngân sách Ăn uống tháng 10/2026 đã dùng 82%." });
    await expense(100_000);
    expect(await listNotifications({ spaceId })).toHaveLength(1);
    await expense(900_000);
    notes = await listNotifications({ spaceId });
    expect(notes).toHaveLength(2);
    expect(notes[0].titleSafe).toBe("Ngân sách Ăn uống tháng 10/2026 đã vượt hạn mức (102%).");
  });

  it("other months and categories do not touch a budget; one budget per category and month", async () => {
    await saveBudget(spaceId, { month: "2026-10", category: "FOOD", limitAmount: 1_000_000 });
    await expense(5_000_000, "EDUCATION");
    await expense(5_000_000, "FOOD", "2026-09-30");
    expect(await listNotifications({ spaceId })).toHaveLength(0);
    await expect(saveBudget(spaceId, { month: "2026-10", category: "FOOD", limitAmount: 2_000_000 })).rejects.toMatchObject({ fields: { category: "BUDGET_DUPLICATE" } });
  });

  it("a new saving creates a maturity reminder on the maturity date that fires 7 days ahead; edits do not add another", async () => {
    const saving = await saveSaving(spaceId, { name: "Sổ VCB", principal: 100_000_000, ratePercent: 5.5, startDate: "2026-01-31", termMonths: 1 }, { memberIds: [MEMBER] });
    const items = await listActive<Item>("item", spaceId);
    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({ title: "Đến hạn sổ tiết kiệm: Sổ VCB", kind: "REMINDER", preset: "PAYMENT", category: "FINANCE" });
    expect(items[0].schedule.start).toBe("2026-02-28T09:00");
    const rules = await listActive<ReminderRule>("reminder_rule", spaceId);
    expect(rules[0].offsetsMinutes).toEqual([7 * 24 * 60]);

    await saveSaving(spaceId, { name: "Sổ VCB 2", principal: 100_000_000, ratePercent: 5.5, startDate: "2026-01-31", termMonths: 1 }, { memberIds: [MEMBER] }, saving.id);
    expect(await listActive<Item>("item", spaceId)).toHaveLength(1);
  });

  it("a loan with a due date gets a reminder; payments and goal contributions append", async () => {
    const loan = await saveLoan(
      spaceId,
      { direction: "BORROWED", counterparty: "Chú Ba", principal: 10_000_000, startDate: "2026-10-01", dueDate: "2026-12-01", payments: [] },
      { memberIds: [MEMBER] },
    );
    expect((await listActive<Item>("item", spaceId))[0].title).toBe("Đến hạn trả nợ: Chú Ba");
    const paid = await addLoanPayment(loan.id, { date: "2026-10-10", amount: 2_000_000 });
    expect(paid.payments).toEqual([{ date: "2026-10-10", amount: 2_000_000 }]);
    expect(paid.createdAt).toBe(loan.createdAt);

    const goal = await saveGoal(spaceId, { name: "Du lịch Đà Lạt", targetAmount: 20_000_000, contributions: [] });
    const grown = await addGoalContribution(goal.id, { date: "2026-10-10", amount: 5_000_000 });
    expect(grown.contributions).toHaveLength(1);
  });

  it("recording a payment reminder makes one linked bill expense", async () => {
    const itemId = "22222222-2222-4222-8222-222222222222";
    const txn = await recordPaymentExpense(spaceId, { itemId, title: "Tiền điện", amount: 420_000 }, "2026-10-06");
    expect(txn).toMatchObject({ type: "EXPENSE", category: "BILLS", amount: 420_000, itemId, note: "Tiền điện", date: "2026-10-06" });
  });
});
