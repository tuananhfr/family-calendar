import type { LocalDate } from "../time/local-date";
import type { LocalDateTime } from "../time/zoned";

export function occurrenceKey(itemId: string, originalStart: LocalDate | LocalDateTime): string {
  return `${itemId}@${originalStart}`;
}

export function parseOccurrenceKey(key: string): { itemId: string; originalStart: LocalDate | LocalDateTime } | null {
  const at = key.lastIndexOf("@");
  if (at <= 0 || at === key.length - 1) return null;
  return { itemId: key.slice(0, at), originalStart: key.slice(at + 1) };
}
