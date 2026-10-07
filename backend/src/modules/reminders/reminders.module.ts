import { Inject, Module, type OnModuleInit } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { AccessModule } from '../access/access.module';
import { DeliveryDispatcher } from '../delivery/dispatcher.service';
import { DeliveryModule } from '../delivery/delivery.module';
import { CLOCK, type Clock } from '../jobs/clock';
import { enqueueJob, JobQueue } from '../jobs/job-queue';
import { JobsModule } from '../jobs/jobs.module';
import { WorkerLoop } from '../jobs/worker-loop';
import { NOTIFICATION_DISPATCHER } from './dispatch';
import { NotificationRunner } from './notification-runner';
import { ReminderScheduler } from './scheduler.service';

const HORIZON_SCAN = 'REMINDER_HORIZON_SCAN';
const HORIZON_SCAN_EVERY_MS = 60 * 60_000;

@Module({
  imports: [JobsModule, AccessModule, DeliveryModule],
  providers: [
    ReminderScheduler,
    NotificationRunner,
    { provide: NOTIFICATION_DISPATCHER, useExisting: DeliveryDispatcher },
  ],
  exports: [ReminderScheduler, NotificationRunner, NOTIFICATION_DISPATCHER],
})
export class RemindersModule implements OnModuleInit {
  constructor(
    private readonly ds: DataSource,
    private readonly worker: WorkerLoop,
    private readonly queue: JobQueue,
    private readonly scheduler: ReminderScheduler,
    private readonly runner: NotificationRunner,
    @Inject(CLOCK) private readonly clock: Clock,
  ) {}

  onModuleInit(): void {
    this.worker.register('RESCHEDULE_REMINDERS', async (job) => {
      const { spaceId, itemId } = job.payload;
      if (typeof spaceId === 'string' && typeof itemId === 'string')
        await this.scheduler.rescheduleItem(spaceId, itemId);
    });
    // Recurring: extends the horizon and, after downtime, catches up (late jobs then meet the late policy).
    // Re-enqueueing its own dedupe key moves this row back to SCHEDULED; the worker's completion then no longer
    // matches the lease and leaves it there.
    this.worker.register(HORIZON_SCAN, async () => {
      await this.scheduler.rescheduleAll();
      await enqueueJob(this.ds.manager, {
        type: HORIZON_SCAN,
        dedupeKey: `${HORIZON_SCAN}:next`,
        runAt: new Date(this.clock.now().getTime() + HORIZON_SCAN_EVERY_MS),
        payload: {},
      });
    });
    this.worker.onStart(() =>
      this.queue.ensure({
        type: HORIZON_SCAN,
        dedupeKey: `${HORIZON_SCAN}:next`,
        runAt: this.clock.now(),
        payload: {},
      }),
    );
    this.worker.addPoller((owner) => this.runner.runDue(owner));
  }
}
