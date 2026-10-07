import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { WorkerLoop } from './modules/jobs/worker-loop';
import { WorkerModule } from './worker.module';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.createApplicationContext(WorkerModule, { logger: ['error', 'warn', 'log'] });
  app.enableShutdownHooks();
  const loop = app.get(WorkerLoop);
  loop.start();
  new Logger('Worker').log(`worker ${loop.owner} started`);
}

void bootstrap();
