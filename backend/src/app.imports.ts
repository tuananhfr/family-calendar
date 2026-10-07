import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { configuration, type AppConfig } from './config/configuration';
import { validateEnv } from './config/env.validation';
import { buildDataSourceOptions } from './database/data-source';

// ENV_FILE='' disables file loading (tests inject env directly).
const envFile = process.env.ENV_FILE ?? '.env';

/** Config + database, shared by the API (AppModule) and the worker process (WorkerModule). */
export const INFRA_IMPORTS = [
  ConfigModule.forRoot({
    isGlobal: true,
    cache: true,
    envFilePath: envFile === '' ? [] : [envFile],
    ignoreEnvFile: envFile === '',
    load: [configuration],
    validate: validateEnv,
  }),
  TypeOrmModule.forRootAsync({
    inject: [ConfigService],
    useFactory: (config: ConfigService<AppConfig, true>) => buildDataSourceOptions(config.get('db', { infer: true })),
  }),
];
