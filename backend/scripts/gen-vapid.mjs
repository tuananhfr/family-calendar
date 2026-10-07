// Writes a VAPID key pair into an env file (default backend/.env): `node scripts/gen-vapid.mjs [file] [--force]`.
// Existing keys are kept unless --force: every browser subscription is bound to the public key, so rotating it
// silently stops push for everyone until they subscribe again.
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import webpush from 'web-push';

const args = process.argv.slice(2);
const force = args.includes('--force');
const file = resolve(args.find((a) => !a.startsWith('--')) ?? '.env');

const text = existsSync(file) ? readFileSync(file, 'utf8') : '';
const eol = text.includes('\r\n') ? '\r\n' : '\n';
const lines = text === '' ? [] : text.split(/\r?\n/);
const current = (name) =>
  lines
    .find((l) => l.startsWith(`${name}=`))
    ?.slice(name.length + 1)
    .trim() ?? '';

if (current('VAPID_PUBLIC_KEY') && current('VAPID_PRIVATE_KEY') && !force) {
  console.error(`${file} already has VAPID keys; pass --force to replace them (existing subscriptions will stop).`);
  process.exit(1);
}

const keys = webpush.generateVAPIDKeys();
const set = (name, value) => {
  const i = lines.findIndex((l) => l.startsWith(`${name}=`));
  if (i >= 0) lines[i] = `${name}=${value}`;
  else
    lines.splice(
      lines.length && lines[lines.length - 1] === '' ? lines.length - 1 : lines.length,
      0,
      `${name}=${value}`,
    );
};
set('VAPID_PUBLIC_KEY', keys.publicKey);
set('VAPID_PRIVATE_KEY', keys.privateKey);
if (!current('VAPID_SUBJECT')) set('VAPID_SUBJECT', 'mailto:admin@localhost');
if (lines[lines.length - 1] !== '') lines.push('');

writeFileSync(file, lines.join(eol));
console.error(`VAPID keys written to ${file}`);
