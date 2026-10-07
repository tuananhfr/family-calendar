// Mirrors frontend/src/core/test-support/process-tz.ts: switch the real process zone in-process (Node re-reads
// TZ on assignment) and probe that the switch took effect. Under Jest the sandboxed process.env is a copy, so
// the switch goes through the setter exposed by test/helpers/tz-environment.cjs.
declare global {
  var __setProcessTimeZone: ((timeZone: string | undefined) => void) | undefined;
  var __getProcessTimeZone: (() => string | undefined) | undefined;
}

function readTz(): string | undefined {
  return globalThis.__getProcessTimeZone ? globalThis.__getProcessTimeZone() : process.env.TZ;
}

function writeTz(timeZone: string | undefined): void {
  if (globalThis.__setProcessTimeZone) globalThis.__setProcessTimeZone(timeZone);
  else if (timeZone === undefined) delete process.env.TZ;
  else process.env.TZ = timeZone;
}

function expectedOffsetMinutes(timeZone: string, instant: Date): number {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hourCycle: 'h23',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).formatToParts(instant);
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value);
  const asUtc = Date.UTC(get('year'), get('month') - 1, get('day'), get('hour'), get('minute'));
  return Math.round((asUtc - instant.getTime()) / 60000);
}

function switchTo(timeZone: string): () => void {
  const previous = readTz();
  const restore = () => writeTz(previous);
  writeTz(timeZone);
  const probe = new Date(Date.UTC(2026, 0, 15, 12));
  const actual = -probe.getTimezoneOffset();
  const expected = expectedOffsetMinutes(timeZone, probe);
  if (actual !== expected) {
    restore();
    throw new Error(`process TZ switch to ${timeZone} did not take effect (offset ${actual}, want ${expected})`);
  }
  return restore;
}

export function withProcessTimeZone<T>(timeZone: string, fn: () => T): T {
  const restore = switchTo(timeZone);
  try {
    return fn();
  } finally {
    restore();
  }
}

export async function withProcessTimeZoneAsync<T>(timeZone: string, fn: () => Promise<T>): Promise<T> {
  const restore = switchTo(timeZone);
  try {
    return await fn();
  } finally {
    restore();
  }
}

export const FOREIGN_TIME_ZONES = ['America/Los_Angeles', 'Pacific/Kiritimati', 'UTC', 'Asia/Ho_Chi_Minh'] as const;
