import { readFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * Signs in to the live deployment with each credential printed in the submission links
 * file, so "credentials verified" in the final check rests on a request rather than on a
 * claim. Prints the account and the outcome only — never a password.
 */

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const config = JSON.parse(await readFile(join(root, 'submission.json'), 'utf8'));
const linksPath = join(
  root,
  'submission',
  `${config.studentId}_LegalConnect_Ghana`,
  'Deployment_and_Source_Links.txt',
);
const links = await readFile(linksPath, 'utf8');

function field(label) {
  const match = new RegExp(`^${label}:\\s*(.+)$`, 'm').exec(links);
  return match?.[1].trim();
}

const accounts = [
  ['Citizen', field('Citizen Username'), field('Citizen Password')],
  ['Lawyer', field('Lawyer Username'), field('Lawyer Password')],
  ['Admin', field('Admin Username'), field('Admin Password')],
];

let failures = 0;

for (const [role, email, password] of accounts) {
  if (!email || !password || password.startsWith('${')) {
    console.log(
      `${role.padEnd(8)} ${email ?? '(missing)'} — no usable credential in the links file`,
    );
    failures += 1;
    continue;
  }

  const res = await fetch(`${config.liveUrl}/api/v1/auth/login`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  const body = await res.json().catch(() => ({}));

  if (res.status === 200 && body.token) {
    console.log(`${role.padEnd(8)} ${email} — 200, role ${body.user?.role}`);
  } else {
    console.log(`${role.padEnd(8)} ${email} — ${res.status} ${body.error?.message ?? ''}`);
    failures += 1;
  }
}

const endpoints = ['/api/health', '/api/v1/categories', '/api/v1/packages', '/api/v1/lawyers'];
for (const path of endpoints) {
  const res = await fetch(`${config.liveUrl}${path}`);
  const body = await res.json().catch(() => null);
  const size = Array.isArray(body)
    ? `${body.length} records`
    : Array.isArray(body?.results)
      ? `${body.total} records`
      : JSON.stringify(body);
  console.log(`${path.padEnd(22)} ${res.status} ${size}`);
  if (res.status !== 200) failures += 1;
}

process.exit(failures > 0 ? 1 : 0);
