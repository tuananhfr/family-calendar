import { beforeEach, describe, expect, it } from "vitest";
import { db } from "@/core/db/db";
import { createLocalSpace } from "@/core/repo/write";
import { usePaymentPrompt } from "../store/payment-prompt";
import { actOnOccurrence } from "./act-on-occurrence";
import { createItemFromForm } from "./item-writes";
import { changeCategory, newFormValues } from "./item-types";
import { occurrenceKey } from "@/core/recurrence/occurrence-key";

beforeEach(async () => {
  await db.delete();
  await db.open();
  usePaymentPrompt.getState().clear();
});

async function reminder(category: "FINANCE" | "OTHER", amount?: number) {
  const spaceId = await createLocalSpace({ kind: "FAMILY", name: "Nhà" });
  const base = changeCategory(newFormValues("REMINDER", { date: "2026-10-06", nowTime: "06:00" }), category);
  const values = { ...base, title: "Tiền điện", amount, startTime: "09:00", memberIds: ["11111111-1111-4111-8111-111111111111"] };
  return createItemFromForm(values, { spaceId, timeZone: "Asia/Ho_Chi_Minh", spaceKind: "FAMILY" });
}

const key = (id: string) => occurrenceKey(id, "2026-10-06T09:00");

describe("actOnOccurrence", () => {
  it("DONE on a payment with an amount asks to record it", async () => {
    const id = await reminder("FINANCE", 420000);
    await actOnOccurrence(id, key(id), "DONE");
    expect(usePaymentPrompt.getState().prompt).toMatchObject({ itemId: id, title: "Tiền điện", amount: 420000 });
  });

  it("no prompt for other actions, other presets or a payment without amount", async () => {
    const paid = await reminder("FINANCE", 420000);
    await actOnOccurrence(paid, key(paid), "SKIP");
    const noAmount = await reminder("FINANCE");
    await actOnOccurrence(noAmount, key(noAmount), "DONE");
    const other = await reminder("OTHER");
    await actOnOccurrence(other, key(other), "DONE");
    expect(usePaymentPrompt.getState().prompt).toBeNull();
  });
});
