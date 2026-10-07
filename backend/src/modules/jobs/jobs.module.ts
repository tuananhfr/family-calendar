import { Module } from '@nestjs/common';
import { CLOCK, SystemClock } from './clock';
import { JobQueue } from './job-queue';
import { WorkerLoop } from './worker-loop';

@Module({
  providers: [{ provide: CLOCK, useClass: SystemClock }, JobQueue, WorkerLoop],
  exports: [CLOCK, JobQueue, WorkerLoop],
})
export class JobsModule {}
