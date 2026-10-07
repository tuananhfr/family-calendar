// Starts the built API for Playwright: e2e env file, pending migrations, then dist/main.js.
import { existsSync } from 'node:fs';
import { createRequire } from 'node:module';

const envFile = existsSync('.env.e2e') ? '.env.e2e' : '.env.e2e.example';
process.env.ENV_FILE = envFile;
process.loadEnvFile(envFile);

if (!existsSync('dist/main.js')) {
  console.error('dist/main.js missing: run `npm run build` first');
  process.exit(1);
}

const require = createRequire(import.meta.url);
const dataSource = require('../dist/database/cli-data-source.js').default;
await dataSource.initialize();
await dataSource.runMigrations({ transaction: 'each' });
await dataSource.destroy();

require('../dist/main.js');
