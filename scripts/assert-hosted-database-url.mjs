// Vercel cannot reach Docker Postgres on the laptop. Fail the build if
// DATABASE_URL is missing or still points at the local compose mapping.
const raw = process.env.DATABASE_URL ?? '';
if (!raw) {
  console.error(
    'DATABASE_URL is not set. Add the Supabase direct Postgres URI in the Vercel project environment (db.<ref>.supabase.co:5432, sslmode=require). Do not copy server/.env.',
  );
  process.exit(1);
}

let parsed;
try {
  parsed = new URL(raw);
} catch {
  console.error('DATABASE_URL is not a valid URL.');
  process.exit(1);
}

const host = parsed.hostname;
if (parsed.port === '6543') {
  console.error(
    'DATABASE_URL looks like the Supabase Transaction pooler (port 6543). prisma migrate deploy needs the Direct URI (port 5432).',
  );
  process.exit(1);
}

if (host === 'localhost' || host === '127.0.0.1' || host === 'postgres') {
  console.error(
    `DATABASE_URL points at ${host}, which is the local Docker database. Vercel cannot reach localhost:5433. Set DATABASE_URL to the Supabase direct URI.`,
  );
  process.exit(1);
}
