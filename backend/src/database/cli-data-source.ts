import { existsSync } from 'node:fs';
import { configuration } from '../config/configuration';
import { createDataSource } from './data-source';

// Used only by the TypeORM CLI (migration:run / revert); the app builds its own via TypeOrmModule.
const envFile = process.env.ENV_FILE ?? '.env';
if (envFile !== '' && existsSync(envFile)) process.loadEnvFile(envFile);

export default createDataSource(configuration().db);
