import { DataSource, type DataSourceOptions } from 'typeorm';
import type { AppConfig } from '../config/configuration';
import { ALL_ENTITIES } from './entities';
import { ALL_MIGRATIONS } from './migrations';

export function buildDataSourceOptions(db: AppConfig['db']): DataSourceOptions {
  return {
    type: 'mariadb',
    host: db.host,
    port: db.port,
    username: db.user,
    password: db.password,
    database: db.database,
    charset: 'utf8mb4_unicode_ci',
    // All DATETIME columns hold UTC; the session time zone must match or NOW() and JS Dates drift.
    timezone: 'Z',
    // DATE stays a 'YYYY-MM-DD' string so all-day values never pass through a JS Date.
    dateStrings: ['DATE'],
    supportBigNumbers: true,
    bigNumberStrings: true,
    synchronize: false,
    migrationsRun: false,
    migrationsTableName: 'migrations',
    migrationsTransactionMode: 'each',
    entities: ALL_ENTITIES,
    migrations: ALL_MIGRATIONS,
    extra: { connectionLimit: 20 },
  };
}

export function createDataSource(db: AppConfig['db']): DataSource {
  return new DataSource(buildDataSourceOptions(db));
}
