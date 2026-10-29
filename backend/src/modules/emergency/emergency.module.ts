import { Module, type OnModuleInit } from '@nestjs/common';
import { RateLimitService } from '../../common/http/rate-limit';
import { AccessModule } from '../access/access.module';
import { DeliveryModule } from '../delivery/delivery.module';
import { JobsModule } from '../jobs/jobs.module';
import { WorkerLoop } from '../jobs/worker-loop';
import { EmergencyAlertService } from './emergency-alert.service';
import { EmergencyController } from './emergency.controller';
import { EmergencyService, SOS_ALERT_JOB } from './emergency.service';
import { EmergencyRecipientsService } from './recipients.service';
import { EmergencyLocationRetention } from './location-retention.service';

@Module({
  imports: [AccessModule, JobsModule, DeliveryModule],
  controllers: [EmergencyController],
  providers: [EmergencyService, EmergencyRecipientsService, EmergencyAlertService, EmergencyLocationRetention, RateLimitService],
})
export class EmergencyModule implements OnModuleInit {
  constructor(
    private readonly worker: WorkerLoop,
    private readonly alerts: EmergencyAlertService,
    private readonly locations: EmergencyLocationRetention,
  ) {}

  onModuleInit(): void {
    this.worker.addPoller(() => this.locations.tick());
    this.worker.register(SOS_ALERT_JOB, async (job) => {
      const { spaceId, eventId } = job.payload;
      if (typeof spaceId === 'string' && typeof eventId === 'string') await this.alerts.run(spaceId, eventId);
    });
  }
}
