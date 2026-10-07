import { RepoError } from "@/core/db/errors";
import type { Priority } from "@/core/model/common";
import type { Item } from "@/core/model/item";
import { getActive } from "@/core/repo/read";
import { saveResource } from "@/core/repo/write";

/** Priority belongs to the whole task (every occurrence), so it never asks "this time or the series". */
export async function setTaskPriority(itemId: string, priority: Priority): Promise<Item> {
  const item = await getActive<Item>("item", itemId);
  if (!item) throw new RepoError("NOT_FOUND", itemId);
  if (item.priority === priority) return item;
  return saveResource("item", { ...item, priority }, "update");
}
