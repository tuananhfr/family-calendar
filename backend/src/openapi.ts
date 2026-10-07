import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';

// The document must be reproducible without a .env or a database (CI, fresh checkout).
const PLACEHOLDER_ENV: Record<string, string> = {
  ENV_FILE: '',
  DB_HOST: '127.0.0.1',
  DB_PORT: '3307',
  DB_USER: 'openapi',
  DB_PASSWORD: '',
  DB_NAME: 'openapi',
  STORAGE_MASTER_KEY: '0'.repeat(64),
};

async function generate(): Promise<void> {
  Object.assign(process.env, PLACEHOLDER_ENV);
  const { AppModule } = await import('./app.module.js');
  const { configureApp } = await import('./app.setup.js');
  // preview mode builds the route graph without instantiating providers, so no DB connection is opened.
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    bodyParser: false,
    preview: true,
    logger: false,
  });
  configureApp(app);
  const document = SwaggerModule.createDocument(
    app,
    new DocumentBuilder().setTitle('Lịch Gia Đình API').setVersion('1').addCookieAuth('fc_sid').build(),
  );
  writeFileSync(join(__dirname, '..', 'openapi.json'), `${JSON.stringify(document, null, 2)}\n`);
  await app.close();
}

void generate();
