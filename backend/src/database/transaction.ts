import type { DataSource, EntityManager } from 'typeorm';

export type IsolationLevel = 'READ COMMITTED' | 'REPEATABLE READ';

const ER_LOCK_DEADLOCK = 1213;
const ER_LOCK_WAIT_TIMEOUT = 1205;

export function isRetryableLockError(err: unknown): boolean {
  if (typeof err !== 'object' || err === null) return false;
  const e = err as { errno?: unknown; driverError?: { errno?: unknown } };
  const errno = e.driverError?.errno ?? e.errno;
  return errno === ER_LOCK_DEADLOCK || errno === ER_LOCK_WAIT_TIMEOUT;
}

function jitterDelay(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 20 + Math.floor(Math.random() * 61)));
}

/**
 * Runs fn in a transaction, retrying the whole fn on deadlock (1213) or lock wait timeout (1205).
 * fn may run more than once, so it must not perform side effects outside the EntityManager.
 */
export async function withTransaction<T>(
  ds: DataSource,
  fn: (em: EntityManager) => Promise<T>,
  opts?: { retries?: number; isolation?: IsolationLevel },
): Promise<T> {
  const retries = opts?.retries ?? 3;
  for (let attempt = 0; ; attempt++) {
    try {
      return opts?.isolation ? await ds.transaction(opts.isolation, fn) : await ds.transaction(fn);
    } catch (err) {
      if (attempt >= retries || !isRetryableLockError(err)) throw err;
      await jitterDelay();
    }
  }
}
