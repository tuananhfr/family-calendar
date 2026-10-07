import { Inject, Module, type OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DataSource } from 'typeorm';
import type { AppConfig } from '../../config/configuration';
import { AccessModule } from '../access/access.module';
import { CLOCK, type Clock } from '../jobs/clock';
import { enqueueJob, JobQueue } from '../jobs/job-queue';
import { JobsModule } from '../jobs/jobs.module';
import { WorkerLoop } from '../jobs/worker-loop';
import { SyncModule } from '../sync/sync.module';
import { AiController } from './ai.controller';
import { AiService } from './ai.service';
import { AutomationRunner } from './automations/automation.runner';
import { AutomationsController } from './automations/automations.controller';
import { AI_PROVIDER, type AiProvider } from './providers/ai-provider';
import { AnthropicProvider } from './providers/anthropic.provider';
import { FakeAiProvider } from './providers/fake.provider';

const AUTOMATION_TICK = 'AUTOMATION_TICK';
const AUTOMATION_TICK_EVERY_MS = 60 * 60_000;

@Module({
  imports: [AccessModule, JobsModule, SyncModule],
  controllers: [AiController, AutomationsController],
  providers: [
    AiService,
    AutomationRunner,
    {
      provide: AI_PROVIDER,
      inject: [ConfigService],
      useFactory: (config: ConfigService<AppConfig, true>): AiProvider | null => {
        const ai = config.get('ai', { infer: true });
        if (ai.provider === 'fake') return new FakeAiProvider();
        return ai.apiKey ? new AnthropicProvider(ai.apiKey, ai.model) : null;
      },
    },
  ],
  exports: [AutomationRunner],
})
export class AiModule implements OnModuleInit {
  constructor(
    private readonly ds: DataSource,
    private readonly worker: WorkerLoop,
    private readonly queue: JobQueue,
    private readonly runner: AutomationRunner,
    @Inject(CLOCK) private readonly clock: Clock,
  ) {}

  onModuleInit(): void {
    // Same self-rescheduling pattern as the reminder horizon scan: one row, moved forward after every run.
    this.worker.register(AUTOMATION_TICK, async () => {
      await this.runner.runDue();
      await enqueueJob(this.ds.manager, {
        type: AUTOMATION_TICK,
        dedupeKey: `${AUTOMATION_TICK}:next`,
        runAt: new Date(this.clock.now().getTime() + AUTOMATION_TICK_EVERY_MS),
        payload: {},
      });
    });
    this.worker.onStart(() =>
      this.queue.ensure({
        type: AUTOMATION_TICK,
        dedupeKey: `${AUTOMATION_TICK}:next`,
        runAt: this.clock.now(),
        payload: {},
      }),
    );
  }
}
