import { Injectable } from '@nestjs/common';
import type { DeliveryChannel, DeliveryResult } from './delivery-channel';

/** TEC-14: no SMS provider in v1; reporting UNSUPPORTED keeps the job from looking delivered. */
@Injectable()
export class SmsChannel implements DeliveryChannel {
  readonly kind = 'SMS' as const;

  send(): Promise<DeliveryResult> {
    return Promise.resolve('UNSUPPORTED');
  }
}
