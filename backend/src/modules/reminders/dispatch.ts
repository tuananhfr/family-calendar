export type NotificationChannel = 'IN_APP' | 'PUSH' | 'EMAIL' | 'SMS';

/** What a dispatcher gets: references only. It loads what it may show itself, under the privacy rules. */
export interface DispatchJob {
  id: string;
  spaceId: string;
  itemId: string;
  occurrenceKey: string;
  channel: NotificationChannel;
  targetDeviceId: string | null;
  targetActorId: string | null;
  targetMemberId: string | null;
  scheduledAt: Date;
}

/**
 * SUBMITTED: handed to the channel (for push: accepted by the push service — not shown, not read). UNSUPPORTED: the
 * channel cannot deliver here (e.g. SMS not configured). GONE: the target no longer exists. RETRY: try again later.
 */
export type DispatchResult = 'SUBMITTED' | 'UNSUPPORTED' | 'GONE' | 'RETRY';

export interface NotificationDispatcher {
  dispatch(job: DispatchJob): Promise<DispatchResult>;
}

export const NOTIFICATION_DISPATCHER = Symbol('NOTIFICATION_DISPATCHER');
