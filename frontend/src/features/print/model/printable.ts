import type { Item } from "@/core/model/item";

/** Paper leaves the app's access control behind: private and health items never go on it (v3.0 §13). */
export function isPrintable(item: Pick<Item, "sharingScope" | "dataClass" | "category" | "preset">): boolean {
  if (item.sharingScope === "PRIVATE") return false;
  if (item.dataClass === "PRIVATE" || item.dataClass === "SENSITIVE") return false;
  return item.category !== "HEALTH" && item.preset !== "MEDICATION";
}
