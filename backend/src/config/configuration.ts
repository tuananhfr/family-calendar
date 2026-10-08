export interface AppConfig {
  port: number;
  host: string;
  apiOrigin: string;
  frontendOrigin: string;
  /** "" at the domain root, "/lich-gia-dinh" under a sub-path; prefixes links in mail/invites/ICS and the cookie path. */
  publicBasePath: string;
  /** Every origin accepted on write requests (FRONTEND_ORIGIN may be a comma-separated list). */
  allowedOrigins: string[];
  db: { host: string; port: number; user: string; password: string; database: string };
  cookieSecure: boolean;
  sessionTtlDays: number;
  /** Multiplies every rate limit (E2E suites register many devices from one IP). */
  rateLimitScale: number;
  storageDir: string;
  storageMasterKey: string;
  /** Upload caps per blob (modules.md §9: 25 MB, video 200 MB); lowered in tests. */
  storageLimits: { fileBytes: number; videoBytes: number };
  vapid: { publicKey: string; privateKey: string; subject: string };
  mail: { transport: 'file' | 'smtp'; dir: string; smtpUrl?: string; from: string };
  /** provider 'fake' is the deterministic offline stand-in for tests and E2E; it never calls a network service. */
  ai: { apiKey?: string; model: string; provider: 'anthropic' | 'fake'; retentionDays: number };
  runWorkerInProcess: boolean;
  /** Offline horizon: older cursors must resync. snapshotMaxRecords caps one snapshot response (TEC-20). */
  sync: { tombstoneDays: number; snapshotMaxRecords: number };
}

function env(name: string, fallback = ''): string {
  const value = process.env[name];
  return value === undefined ? fallback : value;
}

export function configuration(): AppConfig {
  const port = Number(env('PORT', '3005'));
  const host = env('HOST', '127.0.0.1');
  const apiOrigin = env('API_ORIGIN', `http://${host}:${port}`);
  const frontendOrigins = env('FRONTEND_ORIGIN', 'http://localhost:3004')
    .split(',')
    .map((o) => o.trim())
    .filter((o) => o.length > 0);
  return {
    port,
    host,
    apiOrigin,
    frontendOrigin: frontendOrigins[0] ?? '',
    publicBasePath: env('PUBLIC_BASE_PATH').trim().replace(/\/+$/, ''),
    allowedOrigins: [...new Set([...frontendOrigins, apiOrigin])],
    db: {
      host: env('DB_HOST'),
      port: Number(env('DB_PORT', '3307')),
      user: env('DB_USER'),
      password: env('DB_PASSWORD'),
      database: env('DB_NAME'),
    },
    cookieSecure: env('COOKIE_SECURE', 'false') === 'true',
    sessionTtlDays: Number(env('SESSION_TTL_DAYS', '90')),
    rateLimitScale: Number(env('RATE_LIMIT_SCALE', '1')),
    storageDir: env('STORAGE_DIR', 'var/storage'),
    storageMasterKey: env('STORAGE_MASTER_KEY'),
    storageLimits: {
      fileBytes: Number(env('STORAGE_MAX_FILE_BYTES', String(25 * 1024 * 1024))),
      videoBytes: Number(env('STORAGE_MAX_VIDEO_BYTES', String(200 * 1024 * 1024))),
    },
    vapid: {
      publicKey: env('VAPID_PUBLIC_KEY'),
      privateKey: env('VAPID_PRIVATE_KEY'),
      subject: env('VAPID_SUBJECT', 'mailto:admin@localhost'),
    },
    mail: {
      transport: env('MAIL_TRANSPORT', 'file') === 'smtp' ? 'smtp' : 'file',
      dir: env('MAIL_DIR', 'var/mail'),
      smtpUrl: process.env.SMTP_URL || undefined,
      from: env('MAIL_FROM', 'Lich Gia Dinh <no-reply@lich-gia-dinh.local>'),
    },
    ai: {
      apiKey: process.env.ANTHROPIC_API_KEY || undefined,
      model: env('AI_MODEL', 'claude-sonnet-5-5'),
      provider: env('AI_PROVIDER', 'anthropic') === 'fake' ? 'fake' : 'anthropic',
      retentionDays: Number(env('AI_RETENTION_DAYS', '30')),
    },
    runWorkerInProcess: env('RUN_WORKER_IN_PROCESS', 'false') === 'true',
    sync: {
      tombstoneDays: Number(env('SYNC_TOMBSTONE_DAYS', '90')),
      snapshotMaxRecords: Number(env('SYNC_SNAPSHOT_MAX_RECORDS', '20000')),
    },
  };
}
