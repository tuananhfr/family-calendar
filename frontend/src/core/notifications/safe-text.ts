import type { Item } from "../model/item";

// Fixed by the spec (reminders.md Privacy, PRV-001); lock screens and logs must never see more than this.
export const GENERIC_TITLE = "Lịch Gia Đình";
export const GENERIC_BODY = "Mở ứng dụng để xem nhắc của bạn.";

type SafeItem = Pick<Item, "title" | "dataClass" | "sharingScope" | "category" | "preset">;

function isSensitive(item: SafeItem): boolean {
  // Health content is sensitive by nature; a mislabelled NORMAL medication must still stay generic.
  return item.dataClass === "SENSITIVE" || item.category === "HEALTH" || item.preset === "MEDICATION";
}

/**
 * Text for system notifications, toasts outside the app and the local notification center. Only the title can
 * ever appear (never notes, amounts or locations), and only for non-sensitive items when details are allowed.
 */
export function safeNotificationText(item: SafeItem, showDetails: boolean): { title: string; body: string } {
  if (isSensitive(item) || !showDetails) return { title: GENERIC_TITLE, body: GENERIC_BODY };
  return { title: GENERIC_TITLE, body: item.title };
}
