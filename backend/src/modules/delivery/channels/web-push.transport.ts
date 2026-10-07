import { Injectable } from '@nestjs/common';
import { sendNotification, WebPushError } from 'web-push';

export interface WebPushSubscription {
  endpoint: string;
  keys: { p256dh: string; auth: string };
}

export interface WebPushOptions {
  TTL: number;
  urgency: 'normal' | 'high';
  /** Replaces an undelivered message with the same topic at the push service. */
  topic: string;
  vapidDetails: { subject: string; publicKey: string; privateKey: string };
}

/** Status code from the push service; a thrown error means the service was not reached. */
export interface WebPushTransport {
  send(sub: WebPushSubscription, payload: string, options: WebPushOptions): Promise<{ statusCode: number }>;
}

export const WEB_PUSH_TRANSPORT = Symbol('WEB_PUSH_TRANSPORT');

const SEND_TIMEOUT_MS = 10_000;

@Injectable()
export class WebPushLibTransport implements WebPushTransport {
  async send(sub: WebPushSubscription, payload: string, options: WebPushOptions): Promise<{ statusCode: number }> {
    try {
      const result = await sendNotification(sub, payload, { ...options, timeout: SEND_TIMEOUT_MS });
      return { statusCode: result.statusCode };
    } catch (err) {
      if (err instanceof WebPushError) return { statusCode: err.statusCode };
      throw err;
    }
  }
}
