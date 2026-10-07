import { createHash } from 'node:crypto';

// Fixed by reminders.md Privacy / PRV-001 and identical to the frontend's safe-text.ts.
export const GENERIC_TITLE = 'Lịch Gia Đình';
export const GENERIC_BODY = 'Mở ứng dụng để xem nhắc của bạn.';
// Says that help is needed (the generic reminder text would hide an emergency) but not who, where or why.
export const SOS_BODY = 'Có người thân cần trợ giúp khẩn cấp. Mở ứng dụng để xem.';

export interface SafeMessageRef {
  type: string;
  spaceId: string;
  itemId?: string;
  occurrenceKey?: string;
  eventId?: string;
  deliveryId: string;
}

/** Everything that may leave the server in a notification: no notes, amounts, places, people or health words. */
export interface SafeMessage {
  title: string;
  body: string;
  tag: string;
  data: SafeMessageRef;
}

export interface SafeItem {
  title: string;
  dataClass: string;
  sharingScope: string;
  category?: string;
  preset?: string;
}

export function isSensitive(item: SafeItem): boolean {
  // A mislabelled NORMAL medication or health item must still stay generic.
  return item.dataClass === 'SENSITIVE' || item.category === 'HEALTH' || item.preset === 'MEDICATION';
}

/**
 * The only text a notification may carry. SENSITIVE never shows its title; everything else only when the
 * recipient chose details for this channel/device (PRIVATE included: the choice never widens the audience, which
 * the scheduler already limited to people who can read the item).
 */
export function buildSafeMessage(item: SafeItem, pref: { showDetails: boolean }, ref: SafeMessageRef): SafeMessage {
  const generic = isSensitive(item) || !pref.showDetails;
  // Stable per occurrence so a later delivery replaces the earlier one; hashed so the tag reveals no date.
  return {
    title: GENERIC_TITLE,
    body: generic ? GENERIC_BODY : item.title,
    tag: tagFor(ref.occurrenceKey ?? ref.itemId ?? ref.deliveryId),
    data: { ...ref },
  };
}

/** SOS alert: never names the person, place or reason; one tag per event so repeats replace each other. */
export function buildSosMessage(ref: SafeMessageRef & { eventId: string }): SafeMessage {
  return { title: GENERIC_TITLE, body: SOS_BODY, tag: tagFor(`sos:${ref.eventId}`), data: { ...ref } };
}

function tagFor(source: string): string {
  return `fc-${createHash('sha256').update(source).digest('hex').slice(0, 16)}`;
}
