// Vercel cannot reach Docker Postgres on the laptop. Prefer a hosted URL, then
// run Prisma generate/migrate with that value (without printing the secret).
import { spawnSync } from 'node:child_process';

const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', 'postgres']);

function parseUrl(raw) {
  try {
    return new URL(raw);
  } catch {
    return undefined;
  }
}

function resolveDatabaseUrl() {
  const candidates = [
    process.env.DATABASE_URL,
    process.env.POSTGRES_URL_NON_POOLING,
    process.env.POSTGRES_PRISMA_URL,
    process.env.POSTGRES_URL,
  ];
  for (const raw of candidates) {
    if (!raw) continue;
    const parsed = parseUrl(raw);
    if (!parsed) continue;
    if (LOCAL_HOSTS.has(parsed.hostname)) continue;
    if (parsed.port === '6543') continue;
    return { url: raw, host: parsed.hostname };
  }
  return undefined;
}

const resolved = resolveDatabaseUrl();
if (!resolved) {
  console.error(
    'No hosted DATABASE_URL on Vercel. Edit the existing DATABASE_URL variable (do not add a second one) and set it to the Supabase Direct URI (db.<ref>.supabase.co:5432). If you connected the Supabase integration, POSTGRES_URL_NON_POOLING is also accepted. Do not use localhost:5433 or the Transaction pooler on port 6543.',
  );
  process.exit(1);
}

console.error(`Using database host ${resolved.host} for Prisma generate/migrate`);

const env = { ...process.env, DATABASE_URL: resolved.url };
for (const args of [
  ['npm', ['--prefix', 'server', 'run', 'prisma:generate']],
  ['npm', ['--prefix', 'server', 'run', 'prisma:deploy']],
]) {
  const result = spawnSync(args[0], args[1], { stdio: 'inherit', env, shell: true });
  if (result.status) {
    process.exit(result.status);
  }
}
