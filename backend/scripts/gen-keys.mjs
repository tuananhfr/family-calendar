// Prints a fresh 32-byte key for STORAGE_MASTER_KEY; paste it into backend/.env (never commit it).
import { randomBytes } from 'node:crypto';

console.log(`STORAGE_MASTER_KEY=${randomBytes(32).toString('hex')}`);
