import type { SafeMessage } from '../safe-message';

export type DeliveryKind = 'PUSH' | 'EMAIL' | 'SMS' | 'IN_APP';
export type DeliveryResult = 'SUBMITTED' | 'UNSUPPORTED' | 'GONE' | 'RETRY';

export interface DeliveryTarget {
  spaceId: string;
  deviceId: string | null;
  actorId: string | null;
  memberId: string | null;
}

/**
 * Channels never see the record: they ask for the message under their own recipient preference, and the composer
 * (buildSafeMessage) decides what text that preference may reveal.
 */
export type ComposeMessage = (pref: { showDetails: boolean }) => SafeMessage;

export interface DeliveryContext {
  compose: ComposeMessage;
  /** Medication loses its point once late, so the push service may drop it sooner. */
  urgent: boolean;
  /** PRIVATE class or scope: kept generic wherever no per-recipient choice exists. */
  isPrivate: boolean;
}

export interface DeliveryChannel {
  readonly kind: DeliveryKind;
  send(target: DeliveryTarget, ctx: DeliveryContext): Promise<DeliveryResult>;
}
