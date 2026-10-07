import { Module } from '@nestjs/common';
import { JobsModule } from '../jobs/jobs.module';
import { EmailDeliveryChannel } from './channels/email-delivery.channel';
import { EmailChannel } from './channels/email.channel';
import { InAppChannel } from './channels/in-app.channel';
import { PushChannel } from './channels/push.channel';
import { SmsChannel } from './channels/sms.channel';
import { WEB_PUSH_TRANSPORT, WebPushLibTransport } from './channels/web-push.transport';
import { DeliveryDispatcher } from './dispatcher.service';
import { PushSubscriptionsController } from './push-subscriptions.controller';
import { PushSubscriptionsService } from './push-subscriptions.service';

@Module({
  imports: [JobsModule],
  controllers: [PushSubscriptionsController],
  providers: [
    EmailChannel,
    EmailDeliveryChannel,
    InAppChannel,
    PushChannel,
    SmsChannel,
    { provide: WEB_PUSH_TRANSPORT, useClass: WebPushLibTransport },
    DeliveryDispatcher,
    PushSubscriptionsService,
  ],
  exports: [EmailChannel, DeliveryDispatcher, PushChannel, InAppChannel],
})
export class DeliveryModule {}
