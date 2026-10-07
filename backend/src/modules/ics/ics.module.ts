import { Module } from '@nestjs/common';
import { RateLimitService } from '../../common/http/rate-limit';
import { AccessModule } from '../access/access.module';
import { JobsModule } from '../jobs/jobs.module';
import { IntegrationsController } from '../integrations/integrations.controller';
import { IcsController } from './ics.controller';
import { IcsService } from './ics.service';

@Module({
  imports: [AccessModule, JobsModule],
  controllers: [IcsController, IntegrationsController],
  providers: [IcsService, RateLimitService],
})
export class IcsModule {}
