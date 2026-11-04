import { Module } from '@nestjs/common';
import { AccessModule } from '../access/access.module';
import { JobsModule } from '../jobs/jobs.module';
import { ScreenCollectorController } from './screen-collector.controller';
import { ScreenTimeController } from './screen-time.controller';
import { ScreenTimeService } from './screen-time.service';

@Module({
  imports: [AccessModule, JobsModule],
  controllers: [ScreenTimeController, ScreenCollectorController],
  providers: [ScreenTimeService],
})
export class ScreenTimeModule {}
