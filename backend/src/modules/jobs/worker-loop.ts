import { randomBytes } from 'node:crypto';
import { hostname } from 'node:os';
import { Inject, Injectable, Logger, type OnApplicationBootstrap, type OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { AppConfig } from '../../config/configuration';
import { CLOCK, type Clock } from './clock';
import { JobQueue, type Job } from './job-queue';

export type JobHandler = (job: Job) => Promise<void>;
/** Extra queues drained on every tick (notification jobs); returns how many items it handled. */
export type TickPoller = (owner: string) => Promise<number>;

const TICK_MS = 5_000;
const LEASE_MS = 60_000;
const BATCH = 20;
const MAX_ATTEMPTS = 5;

/** Exponential backoff from 30 s, capped at one hour. */
export function retryDelayMs(attempts: number): number {
  return Math.min(30_000 * 2 ** Math.max(0, attempts - 1), 3_600_000);
}

/**
 * The worker side of TEC-12: runs as `dist/worker.js`, or inside the API when RUN_WORKER_IN_PROCESS=true (dev/E2E).
 * Every tick drains due generic jobs, then each registered poller.
 */
@Injectable()
export class WorkerLoop implements OnApplicationBootstrap, OnModuleDestroy {
  private readonly logger = new Logger(WorkerLoop.name);
  private readonly handlers = new Map<string, JobHandler>();
  private readonly pollers: TickPoller[] = [];
  private readonly startHooks: Array<() => Promise<void>> = [];
  readonly owner = `${hostname()}-${process.pid}-${randomBytes(3).toString('hex')}`;
  private timer: NodeJS.Timeout | undefined;
  private running: Promise<void> | undefined;
  private stopped = true;

  constructor(
    private readonly queue: JobQueue,
    private readonly config: ConfigService<AppConfig, true>,
    @Inject(CLOCK) private readonly clock: Clock,
  ) {}

  register(type: string, handler: JobHandler): void {
    this.handlers.set(type, handler);
  }

  addPoller(poller: TickPoller): void {
    this.pollers.push(poller);
  }

  /** Runs once when the loop starts, e.g. to make sure a recurring job exists after a restart. */
  onStart(hook: () => Promise<void>): void {
    this.startHooks.push(hook);
  }

  onApplicationBootstrap(): void {
    if (this.config.get('runWorkerInProcess', { infer: true })) this.start();
  }

  start(): void {
    if (!this.stopped) return;
    this.stopped = false;
    const loop = async () => {
      if (this.stopped) return;
      this.running = this.tick().catch(() => this.logger.error('worker tick failed'));
      await this.running;
      if (!this.stopped) this.timer = setTimeout(() => void loop(), TICK_MS);
    };
    this.running = Promise.all(this.startHooks.map((h) => h()))
      .then(() => undefined)
      .catch(() => this.logger.error('worker start hook failed'))
      .then(() => loop());
  }

  async stop(): Promise<void> {
    this.stopped = true;
    if (this.timer) clearTimeout(this.timer);
    await this.running;
  }

  async onModuleDestroy(): Promise<void> {
    await this.stop();
  }

  /** One pass; exposed so tests and the worker can drive it without timers. */
  async tick(): Promise<void> {
    for (;;) {
      const jobs = await this.queue.leaseBatch(this.owner, BATCH, LEASE_MS);
      for (const job of jobs) await this.run(job);
      if (jobs.length < BATCH) break;
    }
    for (const poller of this.pollers) while ((await poller(this.owner)) > 0);
  }

  private async run(job: Job): Promise<void> {
    const handler = this.handlers.get(job.type);
    if (!handler) {
      await this.queue.fail(job.id, this.owner, 'NO_HANDLER', null);
      return;
    }
    try {
      await handler(job);
      await this.queue.complete(job.id, this.owner);
    } catch (err) {
      // Only the error name: messages from drivers or handlers may echo family content.
      const code = err instanceof Error ? err.name : 'ERROR';
      this.logger.warn(`job ${job.type} failed (${code}), attempt ${job.attempts}`);
      const retryAt =
        job.attempts >= MAX_ATTEMPTS ? null : new Date(this.clock.now().getTime() + retryDelayMs(job.attempts));
      await this.queue.fail(job.id, this.owner, code, retryAt);
    }
  }
}
