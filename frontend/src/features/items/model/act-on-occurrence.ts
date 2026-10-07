import type { Item } from "@/core/model/item";
import { getActive } from "@/core/repo/read";
import { usePaymentPrompt } from "../store/payment-prompt";
import { applyOccurrenceAction, type OccurrenceAction } from "./occurrence-actions";

/** applyOccurrenceAction for UI callers: a finished PAYMENT with an amount then offers to record the expense (never automatic). */
export async function actOnOccurrence(itemId: string, occurrenceKey: string, action: OccurrenceAction, snoozeMinutes?: number): Promise<void> {
  await applyOccurrenceAction(itemId, occurrenceKey, action, snoozeMinutes);
  if (action !== "DONE") return;
  const item = await getActive<Item>("item", itemId);
  if (item?.preset === "PAYMENT" && item.amount) usePaymentPrompt.getState().show({ itemId, occurrenceKey, title: item.title, amount: item.amount });
}
