import { Module } from '@nestjs/common';
import { INFRA_IMPORTS } from './app.imports';
import { AiModule } from './modules/ai/ai.module';
import { EmergencyModule } from './modules/emergency/emergency.module';
import { JobsModule } from './modules/jobs/jobs.module';
import { RemindersModule } from './modules/reminders/reminders.module';

/** Everything the worker process runs; no HTTP stack. */
@Module({
  imports: [...INFRA_IMPORTS, JobsModule, RemindersModule, EmergencyModule, AiModule],
})
export class WorkerModule {}
