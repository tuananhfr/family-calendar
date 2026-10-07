// Integration tests always target the dedicated test database, never the dev one from .env.
const TEST_ENV: Record<string, string> = {
  ENV_FILE: '',
  DB_HOST: '127.0.0.1',
  DB_PORT: '3307',
  DB_USER: 'root',
  DB_PASSWORD: '',
  DB_NAME: 'family_calendar_test',
  HOST: '127.0.0.1',
  PORT: '3007',
  API_ORIGIN: 'http://127.0.0.1:3007',
  FRONTEND_ORIGIN: 'http://localhost:3006',
  COOKIE_SECURE: 'false',
  STORAGE_DIR: 'var/test-storage',
  STORAGE_MASTER_KEY: '7465737400000000000000000000000000000000000000000000000000000000',
  MAIL_TRANSPORT: 'file',
  MAIL_DIR: 'var/test-mail',
  // Test-only key pair; push is sent through a fake transport, never to a real push service.
  VAPID_PUBLIC_KEY: 'BJugQiA4lGi-qfs5T-LidKyWdU5mur5B0xlZODtkkH2m7ovJhHqgGBm3KBGNVWzE_tddSBuLLMGtc6U5liaB6_Y',
  VAPID_PRIVATE_KEY: 'ckZnIOX0nlmS3pKoLDpYLZ9bEcrAQDt12rhpPykp-pA',
  VAPID_SUBJECT: 'mailto:test@example.com',
};

for (const [key, value] of Object.entries(TEST_ENV)) {
  process.env[key] = value;
}
delete process.env.ANTHROPIC_API_KEY;
delete process.env.AI_PROVIDER;
