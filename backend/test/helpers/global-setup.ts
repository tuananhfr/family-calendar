import './env';
import { resetAndMigrate } from './db';

export default async function globalSetup(): Promise<void> {
  await resetAndMigrate();
}
