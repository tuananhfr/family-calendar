import type { NestExpressApplication } from '@nestjs/platform-express';
import { Test } from '@nestjs/testing';
import { DataSource } from 'typeorm';
import { AppModule } from '../../src/app.module';
import { configureApp } from '../../src/app.setup';
import { CLOCK, type Clock } from '../../src/modules/jobs/clock';

export interface TestApp {
  app: NestExpressApplication;
  ds: DataSource;
  close(): Promise<void>;
}

export interface ProviderOverride {
  token: string | symbol | (abstract new (...args: never[]) => unknown);
  value: unknown;
}

export async function createTestApp(opts: { clock?: Clock; overrides?: ProviderOverride[] } = {}): Promise<TestApp> {
  let builder = Test.createTestingModule({ imports: [AppModule] });
  if (opts.clock) builder = builder.overrideProvider(CLOCK).useValue(opts.clock);
  for (const o of opts.overrides ?? []) builder = builder.overrideProvider(o.token).useValue(o.value);
  const moduleRef = await builder.compile();
  const app = moduleRef.createNestApplication<NestExpressApplication>({ bodyParser: false, logger: ['error'] });
  configureApp(app);
  await app.init();
  return { app, ds: app.get(DataSource), close: () => app.close() };
}
